export const OrderLifecycleState = Object.freeze({
  DRAFT: 'DRAFT',
  HELD: 'HELD',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  PREPARING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
  ARCHIVED: 'ARCHIVED'
});

export const KitchenState = Object.freeze({
  PENDING: 'PENDING',
  SENT: 'SENT',
  PREPARING: 'PREPARING',
  READY: 'READY',
  SERVED: 'SERVED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
});

export const PaymentState = Object.freeze({
  UNPAID: 'UNPAID',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED'
});

export const OrderType = Object.freeze({
  DINE_IN: 'DINE_IN',
  TAKEAWAY: 'TAKEAWAY',
  DELIVERY: 'DELIVERY',
  DRIVE_THRU: 'DRIVE_THRU',
  ONLINE: 'ONLINE'
});

export const AllowedLifecycleTransitions = Object.freeze({
  [OrderLifecycleState.DRAFT]: [
    OrderLifecycleState.HELD,
    OrderLifecycleState.PENDING_PAYMENT,
    OrderLifecycleState.PAID,
    OrderLifecycleState.CANCELLED
  ],
  [OrderLifecycleState.HELD]: [
    OrderLifecycleState.DRAFT,
    OrderLifecycleState.PENDING_PAYMENT,
    OrderLifecycleState.PAID,
    OrderLifecycleState.CANCELLED
  ],
  [OrderLifecycleState.PENDING_PAYMENT]: [
    OrderLifecycleState.DRAFT,
    OrderLifecycleState.HELD,
    OrderLifecycleState.PAID,
    OrderLifecycleState.CANCELLED
  ],
  [OrderLifecycleState.PAID]: [
    OrderLifecycleState.PREPARING,
    OrderLifecycleState.READY,
    OrderLifecycleState.SERVED,
    OrderLifecycleState.COMPLETED,
    OrderLifecycleState.REFUNDED,
    OrderLifecycleState.CANCELLED
  ],
  [OrderLifecycleState.PREPARING]: [
    OrderLifecycleState.READY,
    OrderLifecycleState.SERVED,
    OrderLifecycleState.COMPLETED,
    OrderLifecycleState.CANCELLED,
    OrderLifecycleState.REFUNDED
  ],
  [OrderLifecycleState.READY]: [
    OrderLifecycleState.SERVED,
    OrderLifecycleState.COMPLETED,
    OrderLifecycleState.CANCELLED,
    OrderLifecycleState.REFUNDED
  ],
  [OrderLifecycleState.SERVED]: [
    OrderLifecycleState.COMPLETED,
    OrderLifecycleState.REFUNDED,
    OrderLifecycleState.CANCELLED
  ],
  [OrderLifecycleState.COMPLETED]: [
    OrderLifecycleState.REFUNDED,
    OrderLifecycleState.ARCHIVED
  ],
  [OrderLifecycleState.CANCELLED]: [
    OrderLifecycleState.ARCHIVED,
    OrderLifecycleState.DRAFT
  ],
  [OrderLifecycleState.REFUNDED]: [
    OrderLifecycleState.ARCHIVED
  ],
  [OrderLifecycleState.ARCHIVED]: []
});

export const AllowedKitchenTransitions = Object.freeze({
  [KitchenState.PENDING]: [KitchenState.SENT, KitchenState.PREPARING, KitchenState.CANCELLED],
  [KitchenState.SENT]: [KitchenState.PREPARING, KitchenState.READY, KitchenState.CANCELLED],
  [KitchenState.PREPARING]: [KitchenState.READY, KitchenState.SERVED, KitchenState.CANCELLED],
  [KitchenState.READY]: [KitchenState.SERVED, KitchenState.COMPLETED, KitchenState.CANCELLED],
  [KitchenState.SERVED]: [KitchenState.COMPLETED],
  [KitchenState.COMPLETED]: [],
  [KitchenState.CANCELLED]: []
});

export const AllowedPaymentTransitions = Object.freeze({
  [PaymentState.UNPAID]: [PaymentState.PARTIALLY_PAID, PaymentState.PAID],
  [PaymentState.PARTIALLY_PAID]: [PaymentState.PAID, PaymentState.UNPAID, PaymentState.REFUNDED],
  [PaymentState.PAID]: [PaymentState.REFUNDED],
  [PaymentState.REFUNDED]: []
});

// States where modification of order items/cart is permitted
export const EditableLifecycleStates = [
  OrderLifecycleState.DRAFT,
  OrderLifecycleState.HELD,
  OrderLifecycleState.PENDING_PAYMENT
];
