const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, 'migration_003_purchases.sql'), 'utf8');

  // Split by semicolons and run each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      const { error } = await sb.rpc('exec_sql', { sql_text: stmt + ';' });
      if (error) {
        // Try direct query via REST
        console.log('Statement (first 80 chars):', stmt.substring(0, 80) + '...');
        console.log('  Error via rpc:', error.message);
      } else {
        console.log('OK:', stmt.substring(0, 60) + '...');
      }
    } catch (e) {
      console.log('Statement:', stmt.substring(0, 60) + '...');
      console.log('  Exception:', e.message);
    }
  }
}

main().catch(console.error);
