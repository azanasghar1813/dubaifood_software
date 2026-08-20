const path = require('path');
const Database = require('better-sqlite3');
const dbPath = path.join(__dirname, 'pos.db');
const db = new Database(dbPath, { fileMustExist: false });

const res = db.prepare(`
    SELECT d.id, d.deal_id, d.name, d.component_type, d.product_id, d.target_category_id, d.allowed_product_ids, p.name as product_name
    FROM deal_components d
    JOIN products p ON p.id = d.deal_id
    WHERE p.name = 'Deal 33'
`).all();

console.log(JSON.stringify(res, null, 2));
