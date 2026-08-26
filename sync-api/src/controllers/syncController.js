import { supabase } from '../config/supabaseClient.js';
import crypto from 'crypto';

const hashPayload = (obj) => {
  if (!obj) return '';
  const clean = { ...obj };
  delete clean.updated_at;
  delete clean.created_at;
  delete clean.payload_version;
  const str = JSON.stringify(clean, Object.keys(clean).sort());
  return crypto.createHash('md5').update(str).digest('hex');
};

export const pushSyncEvents = async (req, res) => {
  try {
    const { events, terminal_id } = req.body;
    const terminalId = req.headers['x-terminal-id'] || terminal_id || 'UNKNOWN';

    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'events array is required' });
    }

    const results = {
      successful: [],
      failed: [],
      conflicts: []
    };

    // Group events by table and action
    const tableGroups = {};
    for (const event of events) {
      const { entity_type, entity_id, action, payload, payload_version } = event;
      
      const tableMap = {
        'PRODUCT': 'products',
        'CATEGORY': 'categories',
        'DEAL': 'deals',
        'CUSTOMER': 'customers',
        'USER': 'users',
        'EMPLOYEE': 'users',
        'ORDER': 'orders',
        'ORDER_ITEM': 'order_items',
        'ORDER_PAYMENT': 'order_payments',
        'DINING_TABLE': 'dining_tables',
        'SETTING': 'application_settings'
      };

      const tableName = tableMap[entity_type.toUpperCase()];

      if (!tableName) {
        results.failed.push({ eventId: event.id, error: `Unknown entity_type: ${entity_type}` });
        continue;
      }
      
      if (!tableGroups[tableName]) tableGroups[tableName] = { upserts: [], deletes: [], eventMap: {} };
      
      if (action === 'DELETE' || action === 'ARCHIVED') {
        tableGroups[tableName].deletes.push(entity_id);
      } else {
        const entityData = typeof payload === 'string' ? JSON.parse(payload) : payload;
        // Inject terminalId if applicable (e.g. tracking who touched it last)
        tableGroups[tableName].upserts.push({ ...entityData, id: entity_id, payload_version, last_updated_by_device: terminalId });
      }
      tableGroups[tableName].eventMap[entity_id] = event;
    }

    for (const tableName of Object.keys(tableGroups)) {
      const group = tableGroups[tableName];
      
      try {
        if (group.deletes.length > 0) {
          const { error } = await supabase.from(tableName).delete().in('id', group.deletes);
          if (error) throw error;
        }

        if (group.upserts.length > 0) {
          // Check for conflicts in bulk
          const ids = group.upserts.map(u => u.id);
          const { data: existingEntities } = await supabase
            .from(tableName)
            .select('*')
            .in('id', ids);
            
          const existingMap = {};
          if (existingEntities) {
            existingEntities.forEach(e => { existingMap[e.id] = e; });
          }
          
          const validUpserts = [];
          for (const u of group.upserts) {
            const event = group.eventMap[u.id];
            const existing = existingMap[u.id];
            let hasConflict = false;
            
            if (existing) {
              if (existing.payload_version >= u.payload_version) {
                const existingHash = hashPayload(existing);
                const incomingHash = hashPayload(u);
                
                if (existingHash === incomingHash) {
                  // Exact match, no conflict, but skip DB write since it's already there
                  continue;
                } else {
                  results.conflicts.push({
                    eventId: event.id,
                    entityId: u.id,
                    serverVersion: existing.payload_version,
                    clientVersion: u.payload_version,
                    needsPull: true
                  });
                  hasConflict = true;
                }
              } else if (tableName === 'orders' && (existing.lifecycle_state === 'COMPLETED' || existing.status === 'COMPLETED')) {
                results.conflicts.push({
                  eventId: event.id,
                  entityId: u.id,
                  error: 'Order is completed and cannot be mutated.',
                  needsPull: true
                });
                hasConflict = true;
              }
            }
            if (!hasConflict) validUpserts.push(u);
          }

          if (validUpserts.length > 0) {
            const { error: upsertError } = await supabase
              .from(tableName)
              .upsert(validUpserts, { onConflict: 'id' });
            if (upsertError) throw upsertError;
          }
        }
        
        // Mark successful
        for (const entityId of Object.keys(group.eventMap)) {
          const event = group.eventMap[entityId];
          const isConflict = results.conflicts.some(c => c.eventId === event.id);
          if (!isConflict) {
            results.successful.push(event.id);
          }
        }
      } catch (err) {
        // If bulk fails, mark all events in this group as failed
        for (const entityId of Object.keys(group.eventMap)) {
          results.failed.push({ eventId: group.eventMap[entityId].id, error: err.message });
        }
      }
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error('[SyncController] Push error:', error);
    return res.status(500).json({ error: 'Internal server error during sync push' });
  }
};

export const pullSyncEvents = async (req, res) => {
  try {
    const { last_sync_timestamp, limit = 50, offset = 0 } = req.query;
    const since = last_sync_timestamp ? new Date(parseInt(last_sync_timestamp)).toISOString() : new Date(0).toISOString();
    
    const parsedLimit = parseInt(limit, 10) || 50;
    const parsedOffset = parseInt(offset, 10) || 0;

    // Helper to fetch paginated data
    const fetchTable = async (tableName) => {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .gt('updated_at', since)
        .order('updated_at', { ascending: true })
        .range(parsedOffset, parsedOffset + parsedLimit - 1);
      
      if (error) throw error;
      return data;
    };

    // Pull all updated data for all relevant tables
    const [
      products,
      categories,
      orders,
      order_items,
      customers,
      users
    ] = await Promise.all([
      fetchTable('products'),
      fetchTable('categories'),
      fetchTable('orders'),
      fetchTable('order_items'),
      fetchTable('customers'),
      fetchTable('users')
    ]);

    // Return the batched updates
    return res.status(200).json({
      timestamp: Date.now(),
      data: {
        products,
        categories,
        orders,
        order_items,
        customers,
        users
      }
    });
  } catch (error) {
    console.error('[SyncController] Pull error:', error);
    return res.status(500).json({ error: 'Internal server error during sync pull' });
  }
};
