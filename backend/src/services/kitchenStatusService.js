import { KitchenState, AllowedKitchenTransitions, OrderLifecycleState } from '../constants/orderStates.js';

class KitchenStatusService {
  canTransition(currentState, targetState) {
    if (currentState === targetState) return true;
    const allowed = AllowedKitchenTransitions[currentState] || [];
    return allowed.includes(targetState);
  }

  getPriorityWeight(priority = 'NORMAL') {
    switch (String(priority).toUpperCase()) {
      case 'VIP':
        return 1;
      case 'URGENT':
        return 2;
      case 'NORMAL':
        return 3;
      case 'SCHEDULED':
        return 4;
      default:
        return 3;
    }
  }

  getAggregateKitchenState(items = []) {
    if (!Array.isArray(items) || items.length === 0) {
      return KitchenState.PENDING;
    }

    const active = items.filter(item => ![KitchenState.CANCELLED, KitchenState.COMPLETED].includes(item.kitchen_state));
    if (active.length === 0) {
      return KitchenState.COMPLETED;
    }

    if (active.some(item => item.kitchen_state === KitchenState.PENDING || item.kitchen_state === KitchenState.SENT)) {
      return KitchenState.PENDING;
    }

    if (active.some(item => item.kitchen_state === KitchenState.PREPARING)) {
      return KitchenState.PREPARING;
    }

    if (active.some(item => item.kitchen_state === KitchenState.READY)) {
      return KitchenState.READY;
    }

    if (active.some(item => item.kitchen_state === KitchenState.SERVED)) {
      return KitchenState.SERVED;
    }

    return KitchenState.PENDING;
  }

  getAggregateLifecycleState(order, items = []) {
    if (!order) return null;

    const aggregateKitchenState = this.getAggregateKitchenState(items);

    switch (aggregateKitchenState) {
      case KitchenState.PREPARING:
      case KitchenState.READY:
      case KitchenState.SERVED:
        return OrderLifecycleState.ACTIVE;
      case KitchenState.COMPLETED:
        return OrderLifecycleState.COMPLETED;
      default:
        return order.lifecycle_state;
    }
  }
}

export const kitchenStatusService = new KitchenStatusService();
