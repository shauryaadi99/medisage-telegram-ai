import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";

import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOOK_PATH =
  "C:\\Users\\HP\\Desktop\\New folder (2)\\agent\\medical-book.pdf";

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX = process.env.PINECONE_INDEX || "mededu-index-5uywy2h";
const PINECONE_ENV = process.env.PINECONE_ENVIRONMENT || "aped-4627-b74a";
const PINECONE_NAMESPACE = "medical_book_full";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Loading PDF:", BOOK_PATH);
  const loader = new PDFLoader(BOOK_PATH, { splitPages: true });
  const docs = await loader.load();
  console.log("Pages loaded:", docs.length);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1200,
    chunkOverlap: 200,
  });
  const splitDocs = await splitter.splitDocuments(docs);
  console.log("Total chunks created:", splitDocs.length);

  const sanitizedDocs = splitDocs.map((doc, idx) => ({
    pageContent: doc.pageContent,
    metadata: {
      source: doc.metadata?.source || "medical-book",
      page: doc.metadata?.loc?.pageNumber ?? doc.metadata?.page ?? null,
      idx,
    },
  }));

  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004",
  });

  const pc = new Pinecone({
    apiKey: PINECONE_API_KEY,
  });
  const pineconeIndex = pc.index(PINECONE_INDEX);

  // const pineconeIndex = pc.Index(PINECONE_INDEX);
  console.log("Using Pinecone index:", PINECONE_INDEX);

  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    namespace: PINECONE_NAMESPACE,
  });

  const BATCH_SIZE = 100;
  const PAUSE_MS = 1500;

  for (let i = 0; i < sanitizedDocs.length; i += BATCH_SIZE) {
    const batch = sanitizedDocs.slice(i, i + BATCH_SIZE);
    const batchStart = i + 1;
    const batchEnd = i + batch.length;

    console.log(`Embedding chunks ${batchStart}-${batchEnd}...`);
    await vectorStore.addDocuments(batch);
    console.log(`Added to Pinecone: ${batchStart}-${batchEnd}`);
    await sleep(PAUSE_MS);
  }

  console.log(
    "✅ Finished indexing full book into Pinecone:",
    PINECONE_NAMESPACE
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
