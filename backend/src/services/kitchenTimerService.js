class KitchenTimerService {
  _minutesBetween(start, end = new Date()) {
    if (!start) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  }

  buildItemTimers(item, now = new Date()) {
    const receivedAt = item.kitchen_started_at || item.created_at;
    const prepStartAt = item.kitchen_started_at || item.created_at;
    const readyAt = item.kitchen_ready_at || null;
    const servedAt = item.kitchen_served_at || null;
    const completedAt = item.kitchen_completed_at || null;

    const waitingMinutes = this._minutesBetween(receivedAt, now);
    const preparationMinutes = this._minutesBetween(prepStartAt, readyAt || now);
    const readyMinutes = readyAt ? this._minutesBetween(readyAt, servedAt || completedAt || now) : 0;
    const totalKitchenMinutes = this._minutesBetween(item.created_at, completedAt || now);
    const estimatedPrepMinutes = Number(item.estimated_prep_minutes) || 10;
    const overdue = ![ 'READY', 'SERVED', 'COMPLETED', 'CANCELLED' ].includes(item.kitchen_state) && waitingMinutes > estimatedPrepMinutes;

    return {
      waiting_minutes: waitingMinutes,
      preparation_minutes: preparationMinutes,
      ready_minutes: readyMinutes,
      total_kitchen_minutes: totalKitchenMinutes,
      estimated_prep_minutes: estimatedPrepMinutes,
      overdue
    };
  }

  buildOrderTimers(order, items = [], now = new Date()) {
    const orderWaitingMinutes = this._minutesBetween(order.created_at, now);
    const activeItemStarts = items
      .map(item => item.kitchen_started_at || item.created_at)
      .filter(Boolean)
      .sort();

    const totalKitchenMinutes = activeItemStarts.length > 0
      ? this._minutesBetween(activeItemStarts[0], now)
      : orderWaitingMinutes;

    const activeItems = items.filter(item => !['CANCELLED', 'COMPLETED'].includes(item.kitchen_state));
    const overdueItems = activeItems.filter(item => this.buildItemTimers(item, now).overdue).length;

    return {
      order_waiting_minutes: orderWaitingMinutes,
      preparation_minutes: activeItems.reduce((sum, item) => sum + this.buildItemTimers(item, now).preparation_minutes, 0),
      ready_minutes: activeItems.reduce((sum, item) => sum + this.buildItemTimers(item, now).ready_minutes, 0),
      total_kitchen_minutes: totalKitchenMinutes,
      overdue_items: overdueItems
    };
  }
}

export const kitchenTimerService = new KitchenTimerService();
