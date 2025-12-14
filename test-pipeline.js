// test-pipeline.js - COMPLETE TEXT + VISION TEST
import "dotenv/config";
import fs from "fs";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChatGroq } from "@langchain/groq";
import { describeImageEducational } from "./visionDescribe.js";

const CHROMA_URL = "http://localhost:8000";
const COLLECTION_NAME = "medical_book_full";

async function answerWithGroqRag(query) {
  console.log("🔍 Searching book for:", query);
  
  const embeddings = new GoogleGenerativeAIEmbeddings({ model: "text-embedding-004" });
  const store = new Chroma(embeddings, { collectionName: COLLECTION_NAME, url: CHROMA_URL });
  
  const docs = await store.similaritySearch(query, 5);
  console.log("📚 Found chunks:", docs.length);
  
  const llm = new ChatGroq({
    model: "llama-3.1-8b-instant",
    temperature: 0.2,
  });
  
  const prompt = `
You are an AI doctor powered by a medical reference book.

DOCUMENT CONTEXT:
${docs.map(d => d.pageContent.slice(0, 300) + "...").join("\n\n---\n\n")}

USER QUERY: ${query}

MANDATORY DISCLAIMER (end with this):
"I am an AI doctor powered by reference materials. Do NOT rely 100% on me - always consult a licensed physician."
`;

  const res = await llm.invoke(prompt);
  return res.content;
}

async function testText() {
  console.log("=== TEXT QUERY TEST ===\n");
  const answer = await answerWithGroqRag("What causes pimples?");
  console.log("🏥 ANSWER:\n", answer, "\n");
}

async function testVision(imagePath) {
  if (!fs.existsSync(imagePath)) {
    console.log("❌ No image at", imagePath);
    return;
  }
  
  console.log("=== VISION TEST ===\n");
  const description = await describeImageEducational(imagePath);
  console.log("📸 Description:", description);
  
  const answer = await answerWithGroqRag(description);
  console.log("🏥 ANSWER:\n", answer);
}

async function main() {
  await testText();
  
  // Test vision if you have an image
  await testVision("skin-test.jpg"); // put your image here
}

main().catch(console.error);
