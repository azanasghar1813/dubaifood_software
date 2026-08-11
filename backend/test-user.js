import { dbEngine } from './src/database/sqlite.js';
import { userRepository } from './src/repositories/userRepository.js';

dbEngine.connect('C:\\Users\\Azan\\Desktop\\Dubai Food Software\\backend\\storage\\database\\pos.db');

try {
  const users = dbEngine.prepare('SELECT id, first_name, last_name, role_id, is_active FROM users').all();

  for (const u of users) {
    const role = dbEngine.prepare('SELECT name FROM roles WHERE id = ?').get(u.role_id);
    console.log(`User ${u.first_name} role name from DB:`, role ? role.name : 'Unknown');

    const hydrated = userRepository.findById(u.id);
    console.log(`User ${u.first_name} hydrated role_name:`, hydrated.role_name);
    
    const permissions = userRepository.getUserPermissions(u.role_id);
    console.log(`User ${u.first_name} permissions:`, permissions);
  }
} catch (e) {
  console.error(e);
}
