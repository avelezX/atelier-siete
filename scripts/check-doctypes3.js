async function main() {
  const resp = await fetch('http://localhost:3003/api/siigo/document-types');
  const d = await resp.json();
  const types = d.results || [];
  const byType = {};
  types.forEach(t => {
    const k = t.type;
    if (byType[k] === undefined) byType[k] = [];
    byType[k].push(t.name + ' (id:' + t.id + ', code:' + t.code + ')');
  });
  Object.keys(byType).sort().forEach(k => {
    console.log('== ' + k + ' ==');
    byType[k].forEach(n => console.log('  ' + n));
    console.log();
  });
}
main().catch(console.error);
