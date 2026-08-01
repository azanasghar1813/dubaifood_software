import { z } from 'zod';

// ────────────────────────────────────────────────────────────────────────────
// Shared sub-schemas
// ────────────────────────────────────────────────────────────────────────────

const modifierInputSchema = z.object({
  modifier_id: z.string().uuid(),
  group_id: z.string().uuid().optional().nullable(),
  price_adjustment: z.number().optional(),
  quantity: z.number().int().min(1).optional().default(1)
});

const addonInputSchema = z.object({
  addon_id: z.string().uuid(),
  unit_price: z.number().optional(),
  quantity: z.number().int().min(1).optional().default(1)
});

const comboComponentInputSchema = z.object({
  component_id: z.string().optional().nullable(),
  product_id: z.string().uuid(),
  variant_name: z.string().optional().nullable(),
  price_adjustment: z.number().optional().default(0)
});

// ────────────────────────────────────────────────────────────────────────────
// Cart request schemas
// ────────────────────────────────────────────────────────────────────────────

export const addItemToCartSchema = z.object({
  product_id: z.string().uuid({ message: 'product_id must be a valid UUID' }),
  variant_id: z.string().uuid().optional().nullable(),
  modifiers: z.array(modifierInputSchema).optional().default([]),
  addons: z.array(addonInputSchema).optional().default([]),
  comboComponents: z.array(comboComponentInputSchema).optional().default([]),
  quantity: z.number().int().min(1).default(1),
  notes: z.string().max(500).optional().nullable()
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0, { message: 'Quantity must be 0 or greater (0 removes item)' })
});

export const setCartNotesSchema = z.object({
  notes: z.string().max(1000).optional().nullable(),
  kitchen_notes: z.string().max(1000).optional().nullable()
});

export const setCartMetaSchema = z.object({
  order_type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'DRIVE_THRU', 'ONLINE']).optional(),
  customer_id: z.string().uuid().optional().nullable(),
  table_id: z.string().uuid().optional().nullable()
});

export const checkoutCartSchema = z.object({
  order_type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY', 'DRIVE_THRU', 'ONLINE']).optional(),
  customer_id: z.string().uuid().optional().nullable(),
  table_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  branch_id: z.string().optional(),
  business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional()
});
