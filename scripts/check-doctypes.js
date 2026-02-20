// Fetch from local server
fetch('http://localhost:3003/api/siigo/document-types')
  .then(r => r.json())
  .then(d => {
    const types = d.results || [];
    const byType = {};
    types.forEach(t => {
      if (!byType[t.type]) byType[t.type] = [];
      byType[t.type].push(t.name + ' (id:' + t.id + ', code:' + t.code + ')');
    });
    Object.entries(byType).sort().forEach(([type, names]) => {
      console.log('=== Tipo: ' + type + ' ===');
      names.forEach(n => console.log('  ' + n));
      console.log('');
    });
  })
  .catch(e => console.error(e));
