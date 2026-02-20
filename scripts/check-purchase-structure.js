async function main() {
  const resp = await fetch('http://localhost:3003/api/siigo/purchases?page=1&page_size=2');
  const d = await resp.json();
  if (d.results && d.results.length > 0) {
    // Show full structure of first purchase
    console.log(JSON.stringify(d.results[0], null, 2));
    console.log('\n---\n');
    console.log(JSON.stringify(d.results[1], null, 2));
  }
}
main().catch(console.error);
