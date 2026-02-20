const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // 1. Check ALL unique account codes in journal_items to see what exists
  const { data: allCodes } = await sb
    .from('atelier_journal_items')
    .select('account_code')
    .limit(10000);

  const uniqueCodes = [...new Set((allCodes || []).map(r => r.account_code))].sort();
  const codes5xxx = uniqueCodes.filter(c => c.startsWith('5'));
  console.log('=== Todas las cuentas 5xxx en journal_items ===');
  codes5xxx.forEach(c => console.log('  ' + c));
  console.log('');

  // 2. Check if there are purchase invoices (not sales) - Siigo might store them differently
  // Look for accounts 22xx (proveedores), 24xx (impuestos), 1435 credits outside journals
  const { data: allAccounts } = await sb
    .from('atelier_journal_items')
    .select('account_code')
    .limit(20000);

  const allUnique = [...new Set((allAccounts || []).map(r => r.account_code))].sort();
  console.log('=== Todas las cuentas unicas en journal_items (primeros 2 digitos) ===');
  const byPrefix = {};
  allUnique.forEach(c => {
    const p = c.substring(0, 2);
    if (!byPrefix[p]) byPrefix[p] = [];
    byPrefix[p].push(c);
  });
  Object.entries(byPrefix).sort().forEach(([p, codes]) => {
    console.log('  ' + p + 'xx: ' + codes.join(', '));
  });

  // 3. Check voucher_items - maybe expenses are there
  console.log('');
  const { data: voucherAccounts } = await sb
    .from('atelier_voucher_items')
    .select('account_code, movement, description, value')
    .like('account_code', '5%')
    .limit(50);

  console.log('=== Gastos (5xxx) en voucher_items (todos los meses) ===');
  if (voucherAccounts && voucherAccounts.length > 0) {
    voucherAccounts.forEach(i => {
      console.log('  ' + i.account_code + ' ' + i.movement + ' | $' + Math.round(i.value).toLocaleString() + ' | ' + (i.description || ''));
    });
  } else {
    console.log('  No hay gastos 5xxx en voucher_items');
  }

  // 4. Check all voucher_items account codes
  const { data: vAllAccounts } = await sb
    .from('atelier_voucher_items')
    .select('account_code')
    .limit(5000);

  const vUnique = [...new Set((vAllAccounts || []).map(r => r.account_code))].sort();
  console.log('');
  console.log('=== Todas las cuentas en voucher_items ===');
  vUnique.forEach(c => console.log('  ' + c));

  // 5. Search for "arrendamiento" or "gestion" or "administracion" in ANY description
  console.log('');
  for (const term of ['arrendamiento', 'gestion', 'administracion', 'alquiler', 'canon']) {
    const { data: found } = await sb
      .from('atelier_journal_items')
      .select('account_code, movement, description, value')
      .ilike('description', '%' + term + '%')
      .limit(10);

    if (found && found.length > 0) {
      console.log('Items con "' + term + '":');
      found.forEach(i => console.log('  ' + i.account_code + ' ' + i.movement + ' | $' + Math.round(i.value).toLocaleString() + ' | ' + i.description));
    }
  }

  // 6. Check if there are purchase documents we might be missing
  // Look at Siigo document types that were synced
  const { data: journalTypes } = await sb
    .from('atelier_journals')
    .select('name')
    .limit(1000);

  const typeNames = [...new Set((journalTypes || []).map(j => {
    const match = j.name.match(/^([A-Z]+-\d+)/);
    return match ? match[1] : j.name;
  }))].sort();
  console.log('');
  console.log('=== Tipos de journals (prefijos) ===');
  typeNames.forEach(t => console.log('  ' + t));
})();
