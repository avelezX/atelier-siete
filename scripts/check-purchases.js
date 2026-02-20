const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // 1. Search for Bernardo Londoño in customers/suppliers
  const { data: bernardo } = await sb
    .from('atelier_customers')
    .select('identification, name, person_type')
    .or('name.ilike.%bernardo%,name.ilike.%londo%')
    .limit(10);

  console.log('=== Busqueda Bernardo Londoño en clientes ===');
  if (bernardo && bernardo.length > 0) {
    bernardo.forEach(c => console.log('  ' + c.identification + ' | ' + c.name + ' | ' + c.person_type));
  } else {
    console.log('  No encontrado en clientes');
  }

  // 2. Search in suppliers table
  const { data: suppliers } = await sb
    .from('atelier_suppliers')
    .select('identification, name, person_type')
    .or('name.ilike.%bernardo%,name.ilike.%londo%')
    .limit(10);

  console.log('');
  console.log('=== Busqueda Bernardo Londoño en proveedores ===');
  if (suppliers && suppliers.length > 0) {
    suppliers.forEach(s => console.log('  ' + s.identification + ' | ' + s.name + ' | ' + s.person_type));
  } else {
    console.log('  No encontrado en proveedores');
  }

  // 3. Also search for Saman
  const { data: saman } = await sb
    .from('atelier_suppliers')
    .select('identification, name, person_type')
    .ilike('name', '%saman%')
    .limit(10);

  console.log('');
  console.log('=== Busqueda Saman en proveedores ===');
  if (saman && saman.length > 0) {
    saman.forEach(s => console.log('  ' + s.identification + ' | ' + s.name + ' | ' + s.person_type));
  } else {
    console.log('  No encontrado en proveedores');
  }

  // 4. Try fetching purchases from Siigo via our server
  console.log('');
  console.log('=== Probando GET /v1/purchases via Siigo ===');
  try {
    // We don't have this endpoint yet, so test directly
    const resp = await fetch('http://localhost:3003/api/siigo/auth');
    const auth = await resp.json();
    console.log('Auth OK:', auth.success);
  } catch (e) {
    console.log('Error:', e.message);
  }
}

main().catch(console.error);
