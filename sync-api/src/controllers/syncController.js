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

    // Process events in a transaction or individually.
    // For now, we process individually to ensure partial success works
    for (const event of events) {
      try {
        const { entity_type, entity_id, action, payload, payload_version } = event;
        
        // Define table mapping
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
          throw new Error(`Unknown entity_type: ${entity_type}`);
        }

        // Base entity logic
        const entityData = typeof payload === 'string' ? JSON.parse(payload) : payload;

        if (action === 'INSERT' || action === 'UPDATE' || action === 'CREATED') {
          // Check for existing version to handle conflicts (Server-Authoritative)
          // We also fetch 'status' to enforce Order immutability
          const { data: existingEntity } = await supabase
            .from(tableName)
            .select('payload_version, status')
            .eq('id', entity_id)
            .single();

          if (existingEntity) {
            // Conflict check: if the server has a strictly newer version, reject client update
            if (existingEntity.payload_version > payload_version) {
              results.conflicts.push({
                eventId: event.id,
                entityId: entity_id,
                serverVersion: existingEntity.payload_version,
                clientVersion: payload_version
              });
              continue;
            }
            
            // Order Immutability Check: Never overwrite completed orders
            if (entity_type.toUpperCase() === 'ORDER' && existingEntity.status === 'COMPLETED') {
               results.conflicts.push({
                eventId: event.id,
                entityId: entity_id,
                error: 'Order is completed and cannot be mutated.'
              });
              continue;
            }
          }


          // Upsert data
          const { error: upsertError } = await supabase
            .from(tableName)
            .upsert({ 
              ...entityData, 
              id: entity_id,
              payload_version 
            }, { onConflict: 'id' });

          if (upsertError) throw upsertError;

        } else if (action === 'DELETE' || action === 'ARCHIVED') {
          const { error: deleteError } = await supabase
            .from(tableName)
            .delete()
            .eq('id', entity_id);
          
          if (deleteError) throw deleteError;
        }

        results.successful.push(event.id);
      } catch (err) {
        results.failed.push({
          eventId: event.id,
          error: err.message
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
    const { last_sync_timestamp } = req.query;
    const since = last_sync_timestamp ? new Date(parseInt(last_sync_timestamp)).toISOString() : new Date(0).toISOString();

    // Pull updated master data for waiter tablets and web POS
    // Note: In a full enterprise scenario, you would fetch from multiple tables or a dedicated sync log table.
    // For Phase 4 demonstration, we fetch products modified since the last sync.
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('*')
      .gt('updated_at', since);
      
    if (productError) throw productError;

    const { data: categories, error: categoryError } = await supabase
      .from('categories')
      .select('*')
      .gt('updated_at', since);
      
    if (categoryError) throw categoryError;

    // Return the batched updates
    return res.status(200).json({
      timestamp: Date.now(),
      data: {
        products,
        categories
      }
    });
  } catch (error) {
    console.error('[SyncController] Pull error:', error);
    return res.status(500).json({ error: 'Internal server error during sync pull' });
  }
};
