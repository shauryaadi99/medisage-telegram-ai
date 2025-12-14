// telegram-bot.js
import "dotenv/config";
import { createBot } from "./botLogic.js";

const bot = createBot();
bot.startPolling();

console.log("🤖 MedisageBot LIVE (polling)!");
console.log("👨‍💻 Built by Shaurya Aditya Verma");
console.log("📚 19k+ medical chunks indexed (Pinecone)");
console.log("🗄️ Pinecone index:", process.env.PINECONE_INDEX);
console.log("💬 Telegram bot polling started");
