const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Get all journals from December 2025
  const { data: journals } = await sb
    .from('atelier_journals')
    .select('id, date, name, observations')
    .gte('date', '2025-12-01')
    .lt('date', '2026-01-01');

  const journalIds = journals.map(j => j.id);
  const journalMap = new Map();
  journals.forEach(j => journalMap.set(j.id, j));

  console.log('Journals en diciembre 2025:', journals.length);
  console.log('');

  // Get all expense items (5xxx) from those journals
  const { data: items } = await sb
    .from('atelier_journal_items')
    .select('journal_id, account_code, movement, description, value, product_code')
    .in('journal_id', journalIds)
    .like('account_code', '5%')
    .eq('movement', 'Debit')
    .order('value', { ascending: false });

  console.log('=== GASTOS DICIEMBRE 2025 (5xxx Debit) ===');
  console.log('Total items:', items.length);
  console.log('');

  // Group by account prefix (4 digits)
  const byAccount = {};
  items.forEach(i => {
    const prefix = i.account_code.substring(0, 4);
    if (!byAccount[prefix]) byAccount[prefix] = { items: [], total: 0 };
    byAccount[prefix].items.push(i);
    byAccount[prefix].total += Number(i.value);
  });

  Object.entries(byAccount)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([prefix, data]) => {
      console.log('--- ' + prefix + ' (' + data.items.length + ' items) Total: $' + Math.round(data.total).toLocaleString() + ' ---');
      data.items.forEach(i => {
        const j = journalMap.get(i.journal_id);
        console.log('  ' + i.account_code + ' | $' + Math.round(i.value).toLocaleString() + ' | ' + (i.description || '(sin desc)') + ' | CC: ' + (j ? j.name : ''));
      });
      console.log('');
    });

  // Also check: are there expenses in vouchers?
  const { data: vouchers } = await sb
    .from('atelier_vouchers')
    .select('id, date, name, observations')
    .gte('date', '2025-12-01')
    .lt('date', '2026-01-01');

  console.log('=== Vouchers en diciembre 2025:', (vouchers || []).length, '===');

  if (vouchers && vouchers.length > 0) {
    const voucherIds = vouchers.map(v => v.id);
    const { data: vItems } = await sb
      .from('atelier_voucher_items')
      .select('voucher_id, account_code, movement, description, value')
      .in('voucher_id', voucherIds)
      .like('account_code', '5%')
      .eq('movement', 'Debit');

    if (vItems && vItems.length > 0) {
      console.log('Gastos en vouchers (5xxx Debit):', vItems.length);
      vItems.forEach(i => {
        console.log('  ' + i.account_code + ' | $' + Math.round(i.value).toLocaleString() + ' | ' + (i.description || ''));
      });
    } else {
      console.log('No hay gastos 5xxx en vouchers de diciembre');
    }
  }

  // Check: any 5120 (Arrendamiento) anywhere?
  console.log('');
  const { data: arriendo } = await sb
    .from('atelier_journal_items')
    .select('journal_id, account_code, description, value')
    .like('account_code', '5120%')
    .eq('movement', 'Debit')
    .order('value', { ascending: false })
    .limit(20);

  console.log('=== Arrendamientos (5120) en TODOS los meses ===');
  if (arriendo && arriendo.length > 0) {
    arriendo.forEach(i => {
      const j = journalMap.get(i.journal_id);
      console.log('  ' + i.account_code + ' | $' + Math.round(i.value).toLocaleString() + ' | ' + (i.description || '') + ' | CC: ' + (j ? j.name : 'otro mes'));
    });
  } else {
    console.log('  NO HAY registros de arrendamiento (5120) en journal_items');
  }

  // Check: search for "saman" or "arriendo" in descriptions
  console.log('');
  const { data: samanItems } = await sb
    .from('atelier_journal_items')
    .select('journal_id, account_code, movement, description, value')
    .ilike('description', '%saman%')
    .limit(20);

  console.log('=== Items con "saman" en descripcion ===');
  if (samanItems && samanItems.length > 0) {
    samanItems.forEach(i => console.log('  ' + i.account_code + ' ' + i.movement + ' | $' + Math.round(i.value).toLocaleString() + ' | ' + i.description));
  } else {
    console.log('  No hay items con "saman" en journal_items');
  }

  const { data: arriendoDesc } = await sb
    .from('atelier_journal_items')
    .select('journal_id, account_code, movement, description, value')
    .ilike('description', '%arriendo%')
    .limit(20);

  console.log('');
  console.log('=== Items con "arriendo" en descripcion ===');
  if (arriendoDesc && arriendoDesc.length > 0) {
    arriendoDesc.forEach(i => console.log('  ' + i.account_code + ' ' + i.movement + ' | $' + Math.round(i.value).toLocaleString() + ' | ' + i.description));
  } else {
    console.log('  No hay items con "arriendo" en journal_items');
  }
})();
