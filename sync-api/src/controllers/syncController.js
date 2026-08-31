import { supabase } from '../config/supabaseClient.js';
import crypto from 'crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const rowKey = (tableName, row) => (tableName === 'application_settings' ? row.key : row.id);

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

    // Idempotency check: Processed events fallback
    let processedSet = new Set();
    const incomingEventIds = events.map(e => e.id);
    try {
      const { data: alreadyProcessed, error: idempotencyError } = await supabase
        .from('processed_sync_events')
        .select('event_id')
        .in('event_id', incomingEventIds);
        
      if (!idempotencyError && alreadyProcessed) {
        processedSet = new Set(alreadyProcessed.map(r => r.event_id));
      }
    } catch (e) {
      // Ignore if table doesn't exist yet
    }

    const freshEvents = events.filter(e => !processedSet.has(e.id));
    for (const id of processedSet) {
      results.successful.push(id); // Return early success for already-processed events
    }

    // Group events by table and action
    const tableGroups = {};
    for (const event of freshEvents) {
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
        'PAYMENT': 'order_payments',
        'DINING_TABLE': 'dining_tables',
        'SETTING': 'application_settings',
        'VARIANT': 'product_variants'
      };

      const tableName = tableMap[entity_type.toUpperCase()];

      if (!tableName) {
        if (entity_type.toUpperCase() === 'PRINT' || entity_type.toUpperCase() === 'KDS' || entity_type.toUpperCase() === 'RECEIPT') {
          // Gracefully ignore local-only events
          results.successful.push(event.id);
          continue;
        }
        results.failed.push({ eventId: event.id, error: `Unknown entity_type: ${entity_type}` });
        continue;
      }
      
      if (!tableGroups[tableName]) tableGroups[tableName] = { upserts: [], deletes: [], eventMap: {} };
      if (!tableGroups[tableName].eventMap[entity_id]) tableGroups[tableName].eventMap[entity_id] = [];
      
      if (action === 'DELETE' || action === 'ARCHIVED') {
        tableGroups[tableName].deletes.push(entity_id);
      } else {
        try {
          const entityData = typeof payload === 'string' ? JSON.parse(payload) : payload || {};
          
          // --- PAYLOAD SANITIZATION ---
          // Strip local-only columns that do not exist in Supabase cloud schema
          delete entityData.idempotency_key;
          delete entityData.sync_status;
          delete entityData.synced_at;
          delete entityData.sync_hash;
          
          // Strip kitchen timings which might not be in cloud schema
          delete entityData.kitchen_started_at;
          delete entityData.kitchen_ready_at;
          delete entityData.kitchen_served_at;
          delete entityData.kitchen_completed_at;
          delete entityData.kitchen_cancelled_at;
          
          // Critical Fallbacks for old corrupt data
          if (tableName === 'orders' && !entityData.order_number) {
            entityData.order_number = `FALLBACK-${entity_id.substring(0, 8)}`;
          }
          
          const potentialUuidFields = ['shift_id', 'cashier_user_id', 'table_id', 'waiter_id', 'rider_id', 'customer_id', 'kitchen_station_id', 'kitchen_printer_id', 'parent_id', 'category_id'];
          for (const field of potentialUuidFields) {
            if (entityData[field] && typeof entityData[field] === 'string' && !UUID_RE.test(entityData[field])) {
              entityData[field] = null;
            }
          }

          let upsertObj;
          if (tableName === 'application_settings') {
            delete entityData.id;
            upsertObj = {
              key: entityData.key || entity_id,
              value: entityData.value ?? null,
              description: entityData.description ?? null,
              category: entityData.category || 'GENERAL',
              updated_at: entityData.updated_at || new Date().toISOString(),
              payload_version: payload_version || 1
            };
          } else {
            if (typeof entity_id === 'string' && !UUID_RE.test(entity_id)) {
              results.failed.push({ eventId: event.id, error: `Invalid UUID for ${tableName}.id: ${entity_id}` });
              continue;
            }
            upsertObj = { ...entityData, id: entity_id, payload_version };
          }

          const identity = rowKey(tableName, upsertObj);
          const existingIndex = tableGroups[tableName].upserts.findIndex(u => rowKey(tableName, u) === identity);
          if (existingIndex !== -1) {
            tableGroups[tableName].upserts[existingIndex] = upsertObj;
          } else {
            tableGroups[tableName].upserts.push(upsertObj);
          }
          tableGroups[tableName].eventMap[entity_id].push(event);
        } catch (parseError) {
          console.error('[SyncController] Parse error for event', event.id, parseError);
          results.failed.push({ eventId: event.id, error: 'Invalid payload format: ' + parseError.message });
        }
      }
    }

    // Process tables in dependency order to avoid foreign key violations
    const orderedTables = [
      'users',
      'categories',
      'products',
      'product_variants',
      'deals',
      'customers',
      'dining_tables',
      'orders',
      'order_items',
      'order_payments',
      'application_settings'
    ];

    // Ensure we also process any tables that might have been missed in the ordered list
    const tablesToProcess = [
      ...orderedTables.filter(t => tableGroups[t]),
      ...Object.keys(tableGroups).filter(t => !orderedTables.includes(t))
    ];

    const failedParentOrderIds = new Set();

    for (const tableName of tablesToProcess) {
      const group = tableGroups[tableName];
      
      // Prevent foreign key violations if parent order failed in the same batch
      if (tableName === 'order_items' || tableName === 'order_payments') {
        const initialUpserts = [...group.upserts];
        group.upserts = [];
        for (const u of initialUpserts) {
          if (failedParentOrderIds.has(u.order_id)) {
             const events = group.eventMap[u.id] || [];
             for (const event of events) {
               results.failed.push({ eventId: event.id, error: 'Parent order failed to sync in this batch.' });
             }
             delete group.eventMap[u.id];
          } else {
             group.upserts.push(u);
          }
        }
      }
      
      try {
        if (group.deletes.length > 0) {
          const deleteCol = tableName === 'application_settings' ? 'key' : 'id';
          const { error } = await supabase.from(tableName).delete().in(deleteCol, group.deletes);
          if (error) {
             for (const id of group.deletes) {
               const { error: singleError } = await supabase.from(tableName).delete().eq(deleteCol, id);
               if (singleError) {
                 const events = group.eventMap[id] || [];
                 for (const event of events) {
                   results.failed.push({ eventId: event.id, error: singleError.message });
                 }
                 delete group.eventMap[id];
               }
             }
          }
        }

        if (group.upserts.length > 0) {
          // Check for conflicts in bulk
          const conflictCol = tableName === 'application_settings' ? 'key' : 'id';
          const ids = group.upserts.map(u => rowKey(tableName, u));
          const { data: existingEntities } = await supabase
            .from(tableName)
            .select('*')
            .in(conflictCol, ids);
            
          const existingMap = {};
          if (existingEntities) {
            existingEntities.forEach(e => { existingMap[rowKey(tableName, e)] = e; });
          }
          
          const validUpserts = [];
          for (const u of group.upserts) {
            const identity = rowKey(tableName, u);
            const eventsForEntity = group.eventMap[identity] || group.eventMap[u.id] || [];
            const primaryEvent = eventsForEntity[0];
            const existing = existingMap[identity];
            let hasConflict = false;
            
            if (existing && primaryEvent) {
              const existingHash = hashPayload(existing);
              const incomingHash = hashPayload(u);
              if (existingHash === incomingHash) {
                continue;
              }

              const isSystemUser = tableName === 'users' && (
                identity === '00000000-0000-4000-a000-000000000001' ||
                String(u.username || existing.username || '').toLowerCase() === 'system_user'
              );
              if (isSystemUser) {
                continue;
              }

              const incomingTs = Date.parse(u.updated_at || '') || 0;
              const existingTs = Date.parse(existing.updated_at || '') || 0;
              const incomingVersion = Number(u.payload_version || 1);
              const existingVersion = Number(existing.payload_version || 1);
              const incomingIsNewer = incomingTs >= existingTs || incomingVersion >= existingVersion;

              // Last write wins so tills can share the same orders/users without stuck conflicts.
              if (!incomingIsNewer && existingVersion > incomingVersion) {
                continue;
              }
            }
            if (!hasConflict) validUpserts.push(u);
          }

          if (validUpserts.length > 0) {
            // Self-referencing FK resolution for categories (parent_id)
            if (tableName === 'categories') {
              // Extract all category IDs in this batch
              const batchCategoryIds = new Set(validUpserts.map(u => u.id));
              
              // Find categories that reference a parent which is also in this batch
              const dependentCategories = validUpserts.filter(u => u.parent_id && batchCategoryIds.has(u.parent_id));
              
              if (dependentCategories.length > 0) {
                // First pass: upsert ALL categories but temporarily strip the parent_id for the dependent ones
                const firstPassUpserts = validUpserts.map(u => {
                  if (u.parent_id && batchCategoryIds.has(u.parent_id)) {
                    return { ...u, parent_id: null };
                  }
                  return u;
                });
                
                // Do first pass
                const { error: firstPassError } = await supabase.from(tableName).upsert(firstPassUpserts, { onConflict: 'id' });
                
                if (firstPassError) {
                  throw new Error(`Categories first pass failed: ${firstPassError.message}`);
                }
              }
            }

            const { error: upsertError } = await supabase
              .from(tableName)
              .upsert(validUpserts, { onConflict: conflictCol });
              
            if (upsertError) {
              for (const u of validUpserts) {
                const { error: singleError } = await supabase.from(tableName).upsert([u], { onConflict: conflictCol });
                if (singleError) {
                  const identity = rowKey(tableName, u);
                  const events = group.eventMap[identity] || group.eventMap[u.id] || [];
                  for (const event of events) {
                    results.failed.push({ eventId: event.id, error: singleError.message });
                  }
                  delete group.eventMap[u.id];
                  
                  if (tableName === 'orders') {
                    failedParentOrderIds.add(u.id);
                  }
                }
              }
            }
          }
        }
        
        // Mark successful
        for (const entityId of Object.keys(group.eventMap)) {
          const events = group.eventMap[entityId] || [];
          for (const event of events) {
            const isConflict = results.conflicts.some(c => c.eventId === event.id);
            if (!isConflict) {
              results.successful.push(event.id);
            }
          }
        }
      } catch (err) {
        // If bulk fails, mark all events in this group as failed
        for (const entityId of Object.keys(group.eventMap)) {
          const events = group.eventMap[entityId] || [];
          for (const event of events) {
            results.failed.push({ eventId: event.id, error: err.message });
          }
        }
        
        // Ensure child items are blocked from attempting to push
        if (tableName === 'orders') {
          group.upserts.forEach(u => failedParentOrderIds.add(u.id));
        }
      }
    }

    // Record processed event IDs to idempotency table if it exists
    if (results.successful.length > 0) {
      const successfulEventsToRecord = results.successful
        .filter(id => !processedSet.has(id)) // don't insert duplicates
        .map(id => {
          const event = events.find(e => e.id === id);
          return event ? { event_id: id, entity_type: event.entity_type, entity_id: event.entity_id } : null;
        })
        .filter(e => e !== null);
        
      if (successfulEventsToRecord.length > 0) {
        // Fire and forget
        supabase.from('processed_sync_events').insert(successfulEventsToRecord).then(({ error }) => {
          if (error && error.code !== '42P01') { // Ignore 42P01 (relation does not exist)
            console.warn('[SyncController] Failed to record idempotency:', error.message);
          }
        });
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
    const fetchTableSafe = async (tableName) => {
      try {
        return await fetchTable(tableName);
      } catch (err) {
        console.warn(`[Pull] Skipping ${tableName}:`, err.message);
        return [];
      }
    };

    const [
      products,
      categories,
      orders,
      order_items,
      customers,
      users,
      deals,
      order_payments,
      dining_tables,
      application_settings,
      product_variants
    ] = await Promise.all([
      fetchTableSafe('products'),
      fetchTableSafe('categories'),
      fetchTableSafe('orders'),
      fetchTableSafe('order_items'),
      fetchTableSafe('customers'),
      fetchTableSafe('users'),
      fetchTableSafe('deals'),
      fetchTableSafe('order_payments'),
      fetchTableSafe('dining_tables'),
      fetchTableSafe('application_settings'),
      fetchTableSafe('product_variants')
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
        users,
        deals,
        order_payments,
        dining_tables,
        application_settings,
        product_variants
      }
    });
  } catch (error) {
    console.error('[SyncController] Pull error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error during sync pull' });
  }
};
