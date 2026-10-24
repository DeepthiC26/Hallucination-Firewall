import { getAllDocs } from "../lib/doc-registry";

const docs = getAllDocs();
console.log("Total docs:", docs.length);
for (const d of docs) {
  console.log({
    id: d.id,
    title: d.title,
    filename: d.filename,
    domain: d.domain,
    isDataset: d.isDataset,
    datasetId: d.datasetId,
  });
}
