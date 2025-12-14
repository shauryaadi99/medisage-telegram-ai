import "dotenv/config";
import { createBot } from "./botLogic.js";

const bot = createBot();
bot.startPolling();  // LOCAL ONLY - Vercel uses webhooks

console.log("🤖 MedisageBot LIVE (polling - LOCAL DEV ONLY)!");
console.log("🗄️ Pinecone index:", process.env.PINECONE_INDEX);
