const fs = require('fs');
const d = JSON.parse(fs.readFileSync('/tmp/doctypes.json', 'utf8'));
const types = d.results || [];
const byType = {};
types.forEach(t => {
  const k = t.type;
  if (byType[k] === undefined) byType[k] = [];
  byType[k].push(t.name + ' (id:' + t.id + ')');
});
Object.keys(byType).sort().forEach(k => {
  console.log('== ' + k + ' ==');
  byType[k].forEach(n => console.log('  ' + n));
  console.log();
});
