import { orderTotalsService } from '../../services/orderTotalsService.js';

export default {
  version: '041',
  name: 'repair_order_sale_totals',
  up: () => {
    const result = orderTotalsService.repairAllOrders();
    console.log(`[Migration 041] Recalculated ${result.repaired}/${result.total} orders (item subtotals, 7% dine-in service, grand total).`);
  },
  down: () => {}
};
