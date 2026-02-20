const fs = require('fs');
const path = require('path');

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Extract project ref from URL
  const ref = supabaseUrl.replace('https://', '').split('.')[0];

  const sql = fs.readFileSync(path.join(__dirname, 'migration_003_purchases.sql'), 'utf8');

  // Use Supabase Management API to run SQL
  // POST https://{ref}.supabase.co/rest/v1/rpc/... won't work
  // Instead, use the pg REST proxy

  // Alternative: use the Supabase SQL endpoint
  const resp = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  console.log('Status:', resp.status);

  // Since we can't run raw SQL via REST, let's just test if the tables already exist
  // by trying to query them
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(supabaseUrl, serviceKey);

  const { data: test, error } = await sb.from('atelier_purchases').select('id').limit(1);
  if (error) {
    console.log('Table atelier_purchases does not exist yet:', error.message);
    console.log('');
    console.log('Please run the migration SQL manually in Supabase Dashboard > SQL Editor:');
    console.log('File: scripts/migration_003_purchases.sql');
  } else {
    console.log('Table atelier_purchases already exists! Rows:', (test || []).length);
  }
}

main().catch(console.error);
