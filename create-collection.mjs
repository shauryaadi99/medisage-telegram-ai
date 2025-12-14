import { Chroma } from "@langchain/community/vectorstores/chroma";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004",
});

const store = new Chroma(embeddings, {
  collectionName: "medical_book_full",
  host: "mededu-vision-ai.onrender.com",
  port: 443,
  ssl: true,
  apiPath: "/api/v1",
});

await store.addTexts(["test"], [{ id: "1" }]);
console.log("added");
