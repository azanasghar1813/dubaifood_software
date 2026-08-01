import { cartService } from '../services/cartService.js';
import { orderCreationService } from '../services/orderCreationService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

/**
 * CartController
 * 
 * Thin HTTP request handlers that delegate entirely to cartService and
 * orderCreationService. No business logic lives here.
 * 
 * Session identity is read from request headers:
 *   x-cashier-session-id  — the active cashier shift/session ID
 *   x-user-id             — the authenticated user's ID
 *   x-branch-id           — (optional) the branch ID
 */
export const cartController = {
  /**
   * GET /api/cart
   * Returns the current active cart for the session, or an empty cart structure.
   */
  getCart: (req, res) => {
    const sessionId = req.headers['x-cashier-session-id'];
    const userId = req.headers['x-user-id'];
    const branchId = req.headers['x-branch-id'] || 'DEFAULT_BRANCH';

    if (!sessionId) return sendError(res, 400, 'x-cashier-session-id header is required.');

    try {
      const cart = cartService.getOrCreateCart(sessionId, userId, branchId, {
        order_type: req.query.order_type || 'DINE_IN'
      });
      sendSuccess(res, cart, 'Cart retrieved successfully.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  /**
   * POST /api/cart/items
   * Adds a product (with optional variant, modifiers, add-ons, combo) to the cart.
   * Merges quantity if an identical line already exists.
   */
  addItem: (req, res) => {
    const sessionId = req.headers['x-cashier-session-id'];
    const userId = req.headers['x-user-id'];
    const branchId = req.headers['x-branch-id'] || 'DEFAULT_BRANCH';

    if (!sessionId) return sendError(res, 400, 'x-cashier-session-id header is required.');

    try {
      const updatedCart = cartService.addItem(sessionId, userId, branchId, req.body);
      sendSuccess(res, updatedCart, 'Item added to cart.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  /**
   * PUT /api/cart/items/:cartItemId
   * Updates the quantity of a specific cart line item. 
   * Sending quantity: 0 removes the item.
   */
  updateItemQuantity: (req, res) => {
    const sessionId = req.headers['x-cashier-session-id'];
    const userId = req.headers['x-user-id'];

    if (!sessionId) return sendError(res, 400, 'x-cashier-session-id header is required.');
    try {
      const updatedCart = cartService.updateItemQuantity(
        sessionId,
        req.params.cartItemId,
        Number(req.body.quantity),
        userId
      );
      sendSuccess(res, updatedCart, 'Cart item quantity updated.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  updateItemDetails: (req, res) => {
    const sessionId = req.headers['x-cashier-session-id'];
    const userId = req.headers['x-user-id'];

    if (!sessionId) return sendError(res, 400, 'x-cashier-session-id header is required.');

    try {
      const updatedCart = cartService.updateItemDetails(sessionId, req.params.cartItemId, req.body || {}, userId);
      sendSuccess(res, updatedCart, 'Cart item updated.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  duplicateItem: (req, res) => {
    const sessionId = req.headers['x-cashier-session-id'];
    const userId = req.headers['x-user-id'];

    if (!sessionId) return sendError(res, 400, 'x-cashier-session-id header is required.');

    try {
      const updatedCart = cartService.duplicateItem(sessionId, req.params.cartItemId, userId);
      sendSuccess(res, updatedCart, 'Cart item duplicated.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  /**
   * DELETE /api/cart/items/:cartItemId
   * Removes a specific cart line item by its temporary UUID.
   */
  removeItem: (req, res) => {
    const sessionId = req.headers['x-cashier-session-id'];
    const userId = req.headers['x-user-id'];

    if (!sessionId) return sendError(res, 400, 'x-cashier-session-id header is required.');

    try {
      const updatedCart = cartService.removeItem(sessionId, req.params.cartItemId, userId);
      sendSuccess(res, updatedCart, 'Cart item removed.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  /**
   * PATCH /api/cart/notes
   * Sets order-level and kitchen notes on the active cart.
   */
  setNotes: (req, res) => {
    const sessionId = req.headers['x-cashier-session-id'];

    if (!sessionId) return sendError(res, 400, 'x-cashier-session-id header is required.');

    try {
      const updatedCart = cartService.setNotes(sessionId, {
        notes: req.body.notes,
        kitchen_notes: req.body.kitchen_notes
      });
      sendSuccess(res, updatedCart, 'Cart notes updated.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  /**
   * PATCH /api/cart/meta
   * Updates order type, customer assignment, or table assignment on the cart.
   */
  setMeta: (req, res) => {
    const sessionId = req.headers['x-cashier-session-id'];

    if (!sessionId) return sendError(res, 400, 'x-cashier-session-id header is required.');

    try {
      const updatedCart = cartService.setCartMeta(sessionId, {
        order_type: req.body.order_type,
        customer_id: req.body.customer_id,
        table_id: req.body.table_id
      });
      sendSuccess(res, updatedCart, 'Cart metadata updated.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  /**
   * DELETE /api/cart
   * Clears all items from the active cart session (keeps session alive).
   */
  clearCart: (req, res) => {
    const sessionId = req.headers['x-cashier-session-id'];
    const userId = req.headers['x-user-id'];

    if (!sessionId) return sendError(res, 400, 'x-cashier-session-id header is required.');

    try {
      const clearedCart = cartService.clearCart(sessionId, userId);
      sendSuccess(res, clearedCart, 'Cart cleared.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  /**
   * POST /api/cart/checkout
   * Validates the cart and converts it into a permanent Order Draft atomically.
   * This is the ONLY path that creates orders and allocates order numbers.
   */
  checkout: (req, res) => {
    const sessionId = req.headers['x-cashier-session-id'];
    const userId = req.headers['x-user-id'];

    if (!sessionId) return sendError(res, 400, 'x-cashier-session-id header is required.');
    if (!userId) return sendError(res, 400, 'x-user-id header is required.');

    try {
      const order = orderCreationService.checkoutCart(sessionId, userId, req.body || {});
      sendSuccess(res, order, `Order ${order.order_number} created successfully.`, 201);
    } catch (error) {
      sendError(res, 400, error.message);
    }
  }
};
