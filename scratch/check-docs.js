const fs = require('fs');
const docs = JSON.parse(fs.readFileSync('doc-registry.json', 'utf8'));
console.log(JSON.stringify(docs.map(d => ({
  id: d.id,
  name: d.datasetName || d.title || d.filename,
  domain: d.domain,
  firewallDomain: d.firewallDomain,
  isDataset: d.isDataset,
  chunks: d.chunks
})), null, 2));
