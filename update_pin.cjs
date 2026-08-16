const sqlite3 = require('sqlite3').verbose(); 
const db1 = new sqlite3.Database('C:/Users/Azan/Desktop/Dubai Food Software/backend/storage/database/pos.db'); 
const db2 = new sqlite3.Database('C:/Users/Azan/AppData/Roaming/Restaurant POS/storage/database/pos.db'); 
const hash = "$2b$10$hvjp8eg0cVNZprvCFtcLsuUdm37OYQnyjUxVy0meRxwvcyLITJdy.";
db1.run('UPDATE users SET pin_code = ? WHERE username = ?', [hash, 'admin'], function(err) { 
  if(err) console.error(err); else console.log('DB1 updated', this.changes); 
}); 
db2.run('UPDATE users SET pin_code = ? WHERE username = ?', [hash, 'admin'], function(err) { 
  if(err) console.error(err); else console.log('DB2 updated', this.changes); 
});
