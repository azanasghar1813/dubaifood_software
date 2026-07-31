import { dbEngine } from '../database/sqlite.js';
import crypto from 'crypto';

class DealRepository {
  findAll() {
    return dbEngine.prepare(`
      SELECT * FROM deals ORDER BY CAST(REPLACE(code, 'D', '') AS INTEGER) ASC
    `).all();
  }

  findById(id) {
    const deal = dbEngine.prepare(`SELECT * FROM deals WHERE id = ?`).get(id);
    if (deal) {
      deal.groups = this.getGroups(id);
    }
    return deal;
  }

  create(data) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    dbEngine.prepare(`
      INSERT INTO deals (
        id, code, name, description, price, pricing_strategy, 
        lifecycle_state, start_date, end_date, created_at, updated_at
      ) VALUES (
        @id, @code, @name, @description, @price, @pricing_strategy,
        @lifecycle_state, @start_date, @end_date, @now, @now
      )
    `).run({
      id,
      code: data.code,
      name: data.name,
      description: data.description || null,
      price: data.price || 0,
      pricing_strategy: data.pricing_strategy || 'FIXED',
      lifecycle_state: data.lifecycle_state || 'DRAFT',
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      now
    });

    if (data.groups && Array.isArray(data.groups)) {
      this._insertGroups(id, data.groups);
    }

    return this.findById(id);
  }

  update(id, data) {
    const updates = [];
    const params = { id, now: new Date().toISOString() };
    const allowed = ['code', 'name', 'description', 'price', 'pricing_strategy', 'start_date', 'end_date', 'lifecycle_state'];

    allowed.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = @${field}`);
        params[field] = data[field];
      }
    });
    
    if (updates.length > 0) {
      updates.push('version = version + 1');
      updates.push('updated_at = @now');
      dbEngine.prepare(`UPDATE deals SET ${updates.join(', ')} WHERE id = @id`).run(params);
    }

    if (data.groups && Array.isArray(data.groups)) {
      dbEngine.prepare(`DELETE FROM deal_groups WHERE deal_id = ?`).run(id);
      dbEngine.prepare(`DELETE FROM deal_components WHERE deal_id = ?`).run(id);
      this._insertGroups(id, data.groups);
    }

    return this.findById(id);
  }
  delete(id) {
    dbEngine.prepare(`UPDATE deals SET lifecycle_state = 'DELETED', version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
  }

  getGroups(dealId) {
    const groups = dbEngine.prepare(`
      SELECT * FROM deal_groups WHERE deal_id = ? ORDER BY display_order ASC
    `).all(dealId);

    for (const group of groups) {
      group.components = this.getComponentsByGroup(group.id);
    }
    return groups;
  }

  getComponentsByGroup(groupId) {
    return dbEngine.prepare(`
      SELECT dc.*, p.name as product_name, p.product_code, p.price as base_price
      FROM deal_components dc
      JOIN products p ON dc.product_id = p.id
      WHERE dc.deal_group_id = ?
    `).all(groupId);
  }

  _insertGroups(dealId, groups) {
    const insertGroup = dbEngine.prepare(`
      INSERT INTO deal_groups (id, deal_id, name, min_selection, max_selection, display_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertComp = dbEngine.prepare(`
      INSERT INTO deal_components (id, deal_id, deal_group_id, product_id, quantity, max_quantity, price_adjustment, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    groups.forEach((group, groupIndex) => {
      const groupId = crypto.randomUUID();
      insertGroup.run(
        groupId,
        dealId,
        group.name,
        group.min_selection !== undefined ? group.min_selection : 1,
        group.max_selection !== undefined ? group.max_selection : 1,
        group.display_order !== undefined ? group.display_order : groupIndex
      );

      if (group.components && Array.isArray(group.components)) {
        group.components.forEach(comp => {
          insertComp.run(
            crypto.randomUUID(),
            dealId, // Keeping deal_id for quick lookup and cascading
            groupId,
            comp.product_id,
            comp.quantity || 1,
            comp.max_quantity || 1,
            comp.price_adjustment || 0,
            comp.is_default ? 1 : 0
          );
        });
      }
    });
  }
}

export const dealRepository = new DealRepository();
