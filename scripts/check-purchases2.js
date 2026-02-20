async function main() {
  // Fetch purchases page by page and find December 2025 + look for Bernardo/Saman
  const allPurchases = [];
  let page = 1;
  let total = Infinity;

  while (allPurchases.length < total) {
    const resp = await fetch('http://localhost:3003/api/siigo/purchases?page=' + page + '&page_size=100');
    const d = await resp.json();
    if (d.error) { console.log('Error:', d.error); return; }
    total = d.pagination.total_results;
    allPurchases.push(...(d.results || []));
    page++;
    if ((d.results || []).length === 0) break;
    // Small delay to avoid rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('Total purchases fetched:', allPurchases.length);
  console.log('');

  // Filter December 2025
  const dec2025 = allPurchases.filter(p => p.date && p.date.startsWith('2025-12'));
  console.log('=== Purchases DICIEMBRE 2025 (' + dec2025.length + ') ===');

  // Group by account code
  const byAccount = {};
  dec2025.forEach(p => {
    if (p.items) {
      p.items.forEach(item => {
        const code = (item.code || 'unknown').substring(0, 4);
        if (byAccount[code] === undefined) byAccount[code] = { items: [], total: 0 };
        byAccount[code].items.push({
          name: p.name,
          date: p.date,
          supplier: p.supplier ? p.supplier.identification : '',
          desc: item.description,
          price: item.price,
          total: item.total
        });
        byAccount[code].total += item.price || 0;
      });
    }
  });

  Object.entries(byAccount)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([code, data]) => {
      console.log('\n--- ' + code + 'xxxx (' + data.items.length + ' items) Total: $' + Math.round(data.total).toLocaleString() + ' ---');
      data.items.forEach(i => {
        console.log('  ' + i.name + ' | ' + i.date + ' | Supplier: ' + i.supplier + ' | $' + Math.round(i.price).toLocaleString() + ' | ' + i.desc);
      });
    });

  // Search for specific suppliers
  console.log('\n\n=== Busqueda "arrendamiento" en todas las compras ===');
  const arriendo = allPurchases.filter(p =>
    p.items && p.items.some(i => i.description && i.description.toLowerCase().includes('arrendamiento'))
  );
  arriendo.slice(0, 10).forEach(p => {
    console.log('  ' + p.name + ' | ' + p.date + ' | Supplier: ' + (p.supplier ? p.supplier.identification : '') + ' | Total: $' + Math.round(p.total).toLocaleString());
  });

  // Look at the arrendamiento supplier
  if (arriendo.length > 0) {
    const arrendSupplier = arriendo[0].supplier ? arriendo[0].supplier.identification : '';
    console.log('\n=== Todas las compras del proveedor de arriendo (' + arrendSupplier + ') ===');
    const fromLandlord = allPurchases.filter(p => p.supplier && p.supplier.identification === arrendSupplier);
    fromLandlord.forEach(p => {
      console.log('  ' + p.name + ' | ' + p.date + ' | $' + Math.round(p.total).toLocaleString());
      if (p.items) p.items.forEach(i => console.log('    -> ' + i.description + ' $' + Math.round(i.price).toLocaleString()));
    });
  }

  // Search for Saman
  console.log('\n=== Busqueda "gestion" o "saman" en compras ===');
  const gestion = allPurchases.filter(p =>
    p.items && p.items.some(i => i.description && (
      i.description.toLowerCase().includes('gestion') ||
      i.description.toLowerCase().includes('saman') ||
      i.description.toLowerCase().includes('administracion')
    ))
  );
  gestion.slice(0, 10).forEach(p => {
    console.log('  ' + p.name + ' | ' + p.date + ' | Supplier: ' + (p.supplier ? p.supplier.identification : '') + ' | Total: $' + Math.round(p.total).toLocaleString());
    if (p.items) p.items.forEach(i => console.log('    -> ' + i.description + ' $' + Math.round(i.price).toLocaleString()));
  });
}

main().catch(console.error);
