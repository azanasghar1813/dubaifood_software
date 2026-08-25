import fs from 'fs';
import pg from 'pg';

const connectionString = 'postgresql://postgres:Azan@181314@db.rogswfiwwmzgezdueoht.supabase.co:5432/postgres';

const pool = new pg.Pool({
  connectionString,
});

async function runMigration() {
  console.log('Connecting to Supabase...');
  try {
    const sql = fs.readFileSync('./supabase_migration.sql', 'utf8');
    
    console.log('Executing migration script...');
    await pool.query(sql);
    
    console.log('✅ Supabase Migration executed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();
