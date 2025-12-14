import "dotenv/config";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { answerQuestionAboutPdf } from "./askAgent.js"; // import from separate file [web:182]

async function buildVectorStoreFromPdf(pdfPath) {
  const loader = new PDFLoader(pdfPath, { splitPages: true });
  const docs = await loader.load();
  console.log("Pages loaded:", docs.length);

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const splitDocs = await splitter.splitDocuments(docs);
  console.log("Chunks created:", splitDocs.length);

  // keep only first N chunks while learning
  const smallSample = splitDocs.slice(0, 200);

  const embeddings = new GoogleGenerativeAIEmbeddings({
    model: "text-embedding-004",
  });

  const vectorStore = await MemoryVectorStore.fromDocuments(
    smallSample,
    embeddings
  );
  console.log("Vector store ready.");

  return vectorStore;
}

async function main() {
  const store = await buildVectorStoreFromPdf("medical-book.pdf");

  const question = "Why are pimples formed on the skin?";
  const answer = await answerQuestionAboutPdf(store, question);

  console.log("\nQUESTION:");
  console.log(question);
  console.log("\nANSWER:");
  console.log(answer);
}

main().catch(console.error);
