import { z } from 'zod';

export const categoryCreateSchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  parent_id: z.string().uuid().optional().nullable(),
  display_order: z.number().int().min(0).optional().default(0),
  is_active: z.number().int().min(0).max(1).optional().default(1),
  color_code: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid color code').optional().nullable()
});

export const categoryUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  parent_id: z.string().uuid().optional().nullable(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.number().int().min(0).max(1).optional(),
  color_code: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional().nullable()
}).strict();
