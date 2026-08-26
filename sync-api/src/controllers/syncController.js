import { supabase } from '../config/supabaseClient.js';

export const pushSyncEvents = async (req, res) => {
  try {
    const { events } = req.body;

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
        'EMPLOYEE': 'users', // or employees
        'ORDER': 'orders',
        'SETTING': 'settings'
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
        tableGroups[tableName].upserts.push({ ...entityData, id: entity_id, payload_version });
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
            .select('id, payload_version' + (tableName === 'orders' ? ', status' : ''))
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
              if (existing.payload_version > u.payload_version) {
                results.conflicts.push({
                  eventId: event.id,
                  entityId: u.id,
                  serverVersion: existing.payload_version,
                  clientVersion: u.payload_version
                });
                hasConflict = true;
              } else if (tableName === 'orders' && existing.status === 'COMPLETED') {
                results.conflicts.push({
                  eventId: event.id,
                  entityId: u.id,
                  error: 'Order is completed and cannot be mutated.'
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
    const { last_sync_timestamp } = req.query;
    const since = last_sync_timestamp ? new Date(parseInt(last_sync_timestamp)).toISOString() : new Date(0).toISOString();

    // Pull updated master data for waiter tablets and web POS (limit to 1000 to prevent crashing)
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('*')
      .gt('updated_at', since)
      .limit(1000);
      
    if (productError) throw productError;

    const { data: categories, error: categoryError } = await supabase
      .from('categories')
      .select('*')
      .gt('updated_at', since)
      .limit(1000);
      
    if (categoryError) throw categoryError;

    // Pull ONLINE orders that are PENDING for the local POS to download and process
    const { data: onlineOrders, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('source', 'ONLINE')
      .eq('status', 'PENDING')
      .limit(100);

    if (orderError) throw orderError;

    // Return the batched updates
    return res.status(200).json({
      timestamp: Date.now(),
      data: {
        products,
        categories,
        orders: onlineOrders
      }
    });
  } catch (error) {
    console.error('[SyncController] Pull error:', error);
    return res.status(500).json({ error: 'Internal server error during sync pull' });
  }
};
