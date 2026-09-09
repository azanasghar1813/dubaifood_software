import { configService } from './configService.js';

class LanPropagationService {
  /**
   * Call this after ANY order create/update/delete, on either HUB or TERMINAL.
   * - On HUB: push the change out to all connected Terminals via Socket.IO.
   * - On TERMINAL: push the change up to the Hub via HTTP (existing broadcastOrder).
   * Fire-and-forget — never let this throw into the caller's transaction.
   */
  async propagate(orderId) {
    try {
      const syncConfig = configService.getSyncConfig();
      if (syncConfig.lan_sync_enabled === false) return;

      if (syncConfig.device_role === 'HUB') {
        const { socketService } = await import('./socketService.js');
        const { orderService } = await import('./orderService.js');
        const { lanSyncService } = await import('./lanSyncService.js');
        const order = orderService.getOrderById(orderId); // fully hydrated, fresh read
        if (order) {
          socketService.emitOrderUpserted(order);
          lanSyncService._log(`[LanSync] Hub pushed order ${order.order_number} to Terminals via Socket`);
        }
      } else if (syncConfig.device_role === 'TERMINAL' && syncConfig.hub_ip) {
        const { lanSyncService } = await import('./lanSyncService.js');
        lanSyncService.broadcastOrder(orderId);
      }
    } catch (err) {
      console.error('[LanPropagation] Failed to propagate order change:', err.message);
      import('./lanSyncService.js').then(({ lanSyncService }) => {
        lanSyncService._log(`[LanPropagation] Failed to propagate order change: ${err.message}`, 'error');
      }).catch(() => {});
    }
  }

  async propagateDelete(orderId) {
    try {
      const syncConfig = configService.getSyncConfig();
      if (syncConfig.lan_sync_enabled === false) return;

      if (syncConfig.device_role === 'HUB') {
        const { socketService } = await import('./socketService.js');
        const { lanSyncService } = await import('./lanSyncService.js');
        socketService.emitOrderDeleted(orderId);
        lanSyncService._log(`[LanSync] Hub pushed deletion of order ${orderId} to Terminals via Socket`);
      }
    } catch (err) {
      console.error('[LanPropagation] Failed to propagate delete:', err.message);
      import('./lanSyncService.js').then(({ lanSyncService }) => {
        lanSyncService._log(`[LanPropagation] Failed to propagate delete: ${err.message}`, 'error');
      }).catch(() => {});
    }
  }
}

export const lanPropagationService = new LanPropagationService();
