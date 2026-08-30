import { configService } from './configService.js';

/**
 * Kitchen Station Types — maps to physical kitchen stations.
 * Each station receives only its assigned items.
 */
export const KitchenStationType = Object.freeze({
  FAST_FOOD:  'FAST_FOOD',
  RESTAURANT: 'RESTAURANT',
  BBQ:        'BBQ',
  CHINESE:    'CHINESE',
  DESSERT:    'DESSERT',
  DRINKS:     'DRINKS',
  COFFEE:     'COFFEE',
  BAR:        'BAR',
  GENERAL:    'GENERAL',
});

/**
 * KitchenTicketGeneratorService
 *
 * Generates kitchen tickets from a hydrated order.
 * Items are grouped by kitchen_station. Each station receives its own ticket.
 *
 * The Print Engine calls this service and produces one print job per station ticket.
 * If an order has items from 3 stations, 3 separate KITCHEN_TICKET jobs are enqueued.
 */
class KitchenTicketGeneratorService {
  /**
   * Generates one or more kitchen tickets from an order.
   * Items with no station assignment go to a GENERAL ticket.
   *
   * @param {Object} order - Hydrated order with .items[]
   * @returns {Array<Object>} - Array of ticket payloads, one per station
   */
  generateTickets(order) {
    if (!order?.items?.length) return [];

    const businessProfile = configService.getBusinessProfile() || {};
    const kitchenConfig   = configService.getKitchenConfig()   || {};

    const items = [];
    for (const item of order.items) {
      if (item.kitchen_state === 'CANCELLED') continue;
      items.push(item);
    }
    if (items.length === 0) return [];

    return [this._buildTicketPayload({
      order,
      stationData: {
        station_id: 'GENERAL',
        station_name: 'KITCHEN TICKET',
        station_type: KitchenStationType.GENERAL,
        items,
      },
      businessProfile,
      kitchenConfig,
      generatedAt: new Date().toISOString(),
    })];
  }

  /**
   * Generates a SINGLE ticket for a specific station (used for re-fire).
   * @param {Object} order
   * @param {string} stationId
   * @returns {Object|null}
   */
  generateForStation(order, stationId) {
    const tickets = this.generateTickets(order);
    return tickets.find(t => t.station.station_id === stationId) || null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  _buildTicketPayload({ order, stationData, businessProfile, kitchenConfig, generatedAt }) {
    return {
      schema_version: '1.0',
      ticket_type:    'KITCHEN_TICKET',
      generated_at:   generatedAt,

      // Station info
      station: {
        station_id:   stationData.station_id,
        station_name: stationData.station_name,
        station_type: stationData.station_type,
      },

      // Order header (shown at top of every ticket)
      order_header: {
        order_id:       order.id,
        order_number:   order.order_number,
        order_type:     order.order_type,
        table_id:       order.table_id   || null,
        customer_id:    order.customer_id || null,
        cashier_id:     order.cashier_user_id,
        branch_name:    businessProfile.business_name || 'Restaurant',
        business_date:  order.business_date,
        created_at:     order.created_at,
        notes:          order.notes || null,
      },

      // Only items for this station
      items: stationData.items.map(item => this._formatKitchenItem(item)),

      // Total item count for this ticket
      item_count: stationData.items.reduce((sum, i) => sum + (i.quantity || 1), 0),

      // Kitchen config for ticket formatting
      config: {
        show_prices:       kitchenConfig.kitchen_show_prices !== false,
        large_font:        kitchenConfig.kitchen_large_font  !== false,
        highlight_notes:   true,
        bump_on_complete:  kitchenConfig.kitchen_bump_on_complete !== false,
      },
    };
  }

  _formatKitchenItem(item) {
    return {
      item_id:       item.id,
      product_name:  item.product_name_snapshot || item.product_name,
      product_code:  item.product_code_snapshot || item.product_code,
      quantity:      item.quantity,
      notes:         item.notes || null,
      kitchen_state: item.kitchen_state,
      sort_order:    item.sort_order || 0,

      // Variant — shown prominently on kitchen ticket
      variant: item.variant ? {
        variant_name: item.variant.variant_name_snapshot || item.variant.variant_name,
      } : null,

      // Modifiers — each shown as separate line
      modifiers: (item.modifiers || []).map(m => ({
        group_name:    m.group_name_snapshot || m.group_name,
        modifier_name: m.modifier_name_snapshot || m.modifier_name,
        quantity:      m.quantity || 1,
      })),

      // Add-ons
      addons: (item.addons || []).map(a => ({
        addon_name: a.addon_name_snapshot || a.addon_name,
        quantity:   a.quantity,
      })),

      // Combo components
      combo_components: (item.combo_components || item.comboComponents || []).map(c => ({
        product_name: c.product_name_snapshot || c.product_name,
        variant_name: c.variant_snapshot || c.variant_name,
        quantity: c.quantity || 1,
      })),
    };
  }

  _inferStationType(stationId, stationName) {
    const upper = (stationName || stationId || '').toUpperCase();
    if (upper.includes('FAST') || upper.includes('BURGER') || upper.includes('SANDWICH')) return KitchenStationType.FAST_FOOD;
    if (upper.includes('BBQ') || upper.includes('GRILL')) return KitchenStationType.BBQ;
    if (upper.includes('CHINESE') || upper.includes('WOKE') || upper.includes('DIM')) return KitchenStationType.CHINESE;
    if (upper.includes('DESSERT') || upper.includes('SWEET') || upper.includes('PASTRY')) return KitchenStationType.DESSERT;
    if (upper.includes('DRINK') || upper.includes('BEVERAGE') || upper.includes('JUICE')) return KitchenStationType.DRINKS;
    if (upper.includes('COFFEE') || upper.includes('ESPRESSO') || upper.includes('LATTE')) return KitchenStationType.COFFEE;
    if (upper.includes('BAR') || upper.includes('COCKTAIL')) return KitchenStationType.BAR;
    return KitchenStationType.GENERAL;
  }

  _inferStationName(item) {
    // Try to derive station name from product data embedded in item
    return item.kitchen_station_name_snapshot || null;
  }
}

export const kitchenTicketGeneratorService = new KitchenTicketGeneratorService();
