const sqlite3 = require('sqlite3').verbose(); 
const db1 = new sqlite3.Database('C:/Users/Azan/Desktop/Dubai Food Software/backend/storage/database/pos.db'); 
const db2 = new sqlite3.Database('C:/Users/Azan/AppData/Roaming/Restaurant POS/storage/database/pos.db'); 

const permId = require('crypto').randomUUID();
const roleId = '408d0599-ace4-4d46-8244-a62072f9424c';

const insertPerm = (db, cb) => {
  db.run('INSERT OR IGNORE INTO permissions (id, code, description, module) VALUES (?, ?, ?, ?)', [permId, '*', 'All Access', 'ALL'], function(err) {
    if(err) console.error('P error', err);
    db.run('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, permId], function(err) {
      if(err) console.error('RP error', err);
      else console.log('DB updated');
      cb();
    });
  });
};

insertPerm(db1, () => {
  insertPerm(db2, () => console.log('Done'));
});
