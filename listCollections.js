import { ChromaClient } from "chromadb";

const client = new ChromaClient({
  host: "mededu-vision-ai.onrender.com",
  port: 443,
  ssl: true,
  apiPath: "/api/v1",   // <- critical
});

async function main() {
  const collections = await client.listCollections();
  console.log("Collections:", collections);
}

main().catch(console.error);
