import Database from 'better-sqlite3';
const db = new Database('C:/Users/Azan/Desktop/Dubai Food Software/backend/storage/database/pos.db');
db.prepare("INSERT INTO cashier_sessions (id, user_id, terminal_id, opened_at, opening_float, status) VALUES ('mock-session-123', '83d8fc40-6950-4301-ae01-6c2d0dcec542', 'mock-device', CURRENT_TIMESTAMP, 1000, 'OPEN')").run();
console.log('Mock session created!');
