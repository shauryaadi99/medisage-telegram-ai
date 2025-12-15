// import { createBot } from './botLogic.js' assert { type: 'module' };
// botLogic.js
import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { describeImageEducational } from "./vision.js";
import { HumanMessage } from "@langchain/core/messages";

import path from "path";
import fetch from "node-fetch";
import fs from "fs";
import { buildReportText, reportTextToStream } from "./reportFile.js";

import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";

/* -------------------- ENV CHECKS -------------------- */

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("Add TELEGRAM_BOT_TOKEN to .env from @BotFather");

if (!process.env.GOOGLE_API_KEY) throw new Error("Add GOOGLE_API_KEY to .env");
if (!process.env.GROQ_API_KEY) throw new Error("Add GROQ_API_KEY to .env");
if (!process.env.PINECONE_API_KEY)
  throw new Error("Add PINECONE_API_KEY to .env");
if (!process.env.PINECONE_INDEX)
  throw new Error("Add PINECONE_INDEX=Medisage-index to .env");

/* -------------------- PINECONE + VECTOR STORE -------------------- */

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "text-embedding-004",
});

const llm = new ChatGroq({
  model: "llama-3.1-8b-instant",
  temperature: 0.2,
});

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// ✅ FULLY ASYNC Pinecone init
const pineconeIndexPromise = pc.index(process.env.PINECONE_INDEX);
const PINECONE_NAMESPACE = "medical_book_full";

const vectorStorePromise = (async () => {
  const pineconeIndex = await pineconeIndexPromise;
  return PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    namespace: PINECONE_NAMESPACE,
  });
})();

const retrieverPromise = (async () => {
  const vectorStore = await vectorStorePromise;
  return vectorStore.asRetriever({ k: 5 });
})();

/* -------------------- CORE RAG FUNCTION -------------------- */

async function answerMedicalQuery(query) {
  console.log("🔍 RAG START:", query); // ← 1 LINE

  const retriever = await retrieverPromise;
  console.log("✅ Retriever OK"); // ← 1 LINE

  // const retrievedDocs = await retriever.invoke(query);

  // if (!retrievedDocs.length) {
  //   console.log('❌ NO DOCS');         // ← 1 LINE
  //   return "❌ No info found...";
  // }

  // const retriever = await retrieverPromise;
  const retrievedDocs = await retriever.invoke(query);
  console.log(`📚 Docs: ${retrievedDocs.length}`); // ← 1 LINE

  if (!retrievedDocs.length) {
    return (
      "❌ I could not find reliable information in the medical book for this question.\n\n" +
      "Try rephrasing with more detail (age, main symptom, duration).\n\n" +
      "_Reminder: In case of severe pain, breathing difficulty, chest pain, confusion, or other alarming symptoms, seek urgent in‑person medical care._"
    );
  }

  const context = retrievedDocs
    .map((d, i) => `--- [Chunk ${i + 1}]\n${d.pageContent}`)
    .join("\n\n");

  const prompt = `
You are an AI medical assistant answering questions using ONLY the context below from a medical reference book.

CONTEXT:
${context}

USER QUESTION:
${query}

INSTRUCTIONS:
- Answer using ONLY the information in CONTEXT.
- If the context is insufficient, say so explicitly and suggest what the user should ask a real doctor.
- Use clear headings and bullet points where helpful.
- - Be brief and focus only on the 3–5 most important points for a patient.
- Limit the whole answer to about 8–10 short bullet points plus the disclaimer.
- Highlight serious "red flag" symptoms (if mentioned in context) that require urgent in‑person care.

RESPONSE FORMAT:
1. Short direct answer (2–3 sentences).
2. Sections as needed, for example:
   - Possible causes
   - Typical symptoms
   - Evaluation / tests
   - Treatment options
   - Self‑care and lifestyle
3. A *final disclaimer* paragraph.

Formatting Rules:
- Do NOT use asterisks (*) anywhere.
- Use the tag [RED_FLAG] before urgent warnings.
- Use clear section headers with colons.
- Keep language simple and medical-safe.

MANDATORY FINAL DISCLAIMER (always include, even if repeating):
"I am an AI medical assistant using reference materials. This is not a diagnosis or personal medical advice. Do not rely on this alone — always consult a licensed physician for decisions about your health."
`;

  let coreAnswer;

  try {
    const res = await llm.invoke([new HumanMessage(prompt)]);

    coreAnswer = typeof res === "string" ? res : res?.content || "";

    if (!coreAnswer) {
      throw new Error("LLM returned empty response");
    }
  } catch (err) {
    console.error("💥 RAG LLM Error:", {
      message: err.message,
      stack: err.stack,
    });
    throw err;
  }
  console.log("✅ RAG COMPLETE"); // ← 1 LINE
  

  const signature =
    `\n\n————————————\n` +
    `👨‍💻 *Created by Shaurya Aditya Verma*\n` +
    `🩺 _Medisage AI Doctor – educational, not a substitute for a real doctor_`;

  return coreAnswer + signature;
}

function appendActions(reply) {
  const actions =
    "\n\n————————————\n" +
    "➡️ Use */quickconsult* for a new quick question.\n" +
    "📄 Use */healthreport* to start a full guided report.\n" +
    "🏠 Use */start* to see all options again.";
  return reply + actions;
}

/* -------------------- VISION HELPER -------------------- */

async function describeImageEducationalLocal(imagePath) {
  try {
    const HF_TOKEN = process.env.HF_TOKEN;
    const absPath = path.resolve(imagePath);
    const imageBuffer = fs.readFileSync(absPath);
    const imageBase64 = imageBuffer.toString("base64");
    const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Medical image analyst. Describe for diagnosis: location, size, color, inflammation. " +
                    "Example: 'white ulcer on inner lip, 5mm, red rim'. 1 sentence.",
                },
                {
                  type: "image_url",
                  image_url: { url: dataUrl },
                },
              ],
            },
          ],
          model: "zai-org/GLM-4.6V-Flash:novita",
          stream: false,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HF error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    return content.substring(0, 400).trim();
  } catch (err) {
    console.error("describeImageEducational error:", err);
    return null;
  }
}

/* -------------------- MAIN BOT LOGIC FACTORY -------------------- */

function handleGreetings(text) {
  const t = text.trim().toLowerCase();

  if (["hi", "hello", "hey", "hii", "hiii"].includes(t)) {
    return (
      "Hello! 👋 I’m *Medisage AI Doctor*.\n\n" +
      "You can use:\n" +
      "• /quickconsult – for a quick medical question\n" +
      "• /healthreport – for a full guided health report"
    );
  }

  if (["thank you", "thanks", "thx", "ty"].includes(t)) {
    return "You’re welcome! 😊 If you have another health question, try /quickconsult or /healthreport.";
  }

  if (
    ["good morning", "good evening", "good night"].some((p) => t.startsWith(p))
  ) {
    return (
      "Wishing you good health! 🌿\n\n" +
      "Send /quickconsult for a quick question or /healthreport for a full report."
    );
  }

  return null; // not a greeting
}

const chatState = new Map(); // chatId -> { mode, step, form, lastReport }
export function createBot() {
  // note: polling: false – runner will decide
  const bot = new TelegramBot(token, { polling: false });

  /* /start COMMAND */

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    bot.sendMessage(
      chatId,
      "🩺 *Medisage AI Doctor* — Your Smart Medical Companion\n\n" +
        "Choose how you want to use the bot:\n\n" +
        "1️⃣ */quickconsult* – Quick question, fast educational answer.\n" +
        "2️⃣ */healthreport* – Full guided health report with structured output.\n\n" +
        "You can also send a medical image any time, and I’ll analyze it as part of your question.\n\n" +
        "————————————\n" +
        "👨‍💻 *Created by Shaurya Aditya Verma*",
      { parse_mode: "Markdown" }
    );
  });

  /* /quickconsult */

  bot.onText(/\/quickconsult/, (msg) => {
    const chatId = msg.chat.id;
    chatState.set(chatId, { mode: "quick" });

    bot.sendMessage(
      chatId,
      "🩺 *Quick Consult*\n\n" +
        "Send your health question as a normal text message.\n\n" +
        "Examples:\n" +
        "• `Is this kind of mouth ulcer serious?`\n" +
        "• `I have a mild headache for 2 days, should I worry?`",
      { parse_mode: "Markdown" }
    );
  });

  /* /healthreport */

  bot.onText(/\/healthreport/, (msg) => {
    const chatId = msg.chat.id;
    chatState.set(chatId, {
      mode: "report",
      step: "askName",
      form: {},
    });

    bot.sendMessage(
      chatId,
      "📄 *Guided Health Report*\n\n" +
        "I’ll ask a few questions to create a structured, doctor-style report.\n\n" +
        "First, please tell me your *name*.",
      { parse_mode: "Markdown" }
    );
  });

  /* PHOTO HANDLER */

  bot.on("photo", async (msg) => {
    const chatId = msg.chat.id;

    try {
      const photo = msg.photo[msg.photo.length - 1];
      const fileId = photo.file_id;

      const file = await bot.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;

      const localPath = path.join(process.cwd(), `temp-${chatId}.jpg`);
      const res = await fetch(fileUrl);
      const arrayBuffer = await res.arrayBuffer();
      fs.writeFileSync(localPath, Buffer.from(arrayBuffer));

      await bot.sendMessage(
        chatId,
        "🖼 Analyzing your image with the vision model to create a medical query..."
      );

      const description = await describeImageEducationalLocal(localPath);
      fs.unlink(localPath, () => {});

      if (!description) {
        await bot.sendMessage(
          chatId,
          "⚠️ I could not analyze this image. Please describe your condition in text."
        );
        return;
      }

      const query =
        "Image-based medical question. The image looks like: " + description;

      await bot.sendMessage(
        chatId,
        "🔍 Using the image description as a query to the medical reference..."
      );

      const answer = await answerMedicalQuery(query);

      let reply = String(answer);
      if (reply.length > 4090) {
        reply =
          reply.slice(0, 4050) +
          "\n\n…answer truncated for Telegram length limit…";
      }
      reply = appendActions(reply);

      await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("photo handler error:", error);
      await bot.sendMessage(
        chatId,
        "⚠️ Error processing image. Please describe your problem in text."
      );
    }
  });

  /* MAIN MESSAGE HANDLER */

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!text || text.startsWith("/")) return;

    // Small-talk / greetings first
    const greetingReply = handleGreetings(text);
    if (greetingReply) {
      await bot.sendMessage(chatId, greetingReply, { parse_mode: "Markdown" });
      return; // do not run RAG for simple greetings
    }

    const state = chatState.get(chatId);

    // 1) Guided Health Report flow
    if (state && state.mode === "report") {
      const form = state.form;

      if (state.step === "askName") {
        form.name = text.trim();
        state.step = "askAge";
        chatState.set(chatId, state);

        await bot.sendMessage(
          chatId,
          `Thanks, *${form.name}*.\nNow please tell me your *age* (in years).`,
          { parse_mode: "Markdown" }
        );
        return;
      }

      if (state.step === "askAge") {
        form.age = text.trim();
        state.step = "askProblem";
        chatState.set(chatId, state);

        await bot.sendMessage(
          chatId,
          "Got it.\nNow describe your main problem and symptoms in your own words.",
          { parse_mode: "Markdown" }
        );
        return;
      }

      if (state.step === "askProblem") {
        form.problem = text.trim();
        chatState.delete(chatId); // end guided flow state

        const combinedQuery =
          `Guided health report for patient.\n` +
          `Name: ${form.name}\n` +
          `Age: ${form.age}\n` +
          `Main complaint: ${form.problem}\n\n` +
          `Write a structured, doctor-style educational report with sections:\n` +
          `Short Direct Answer, Possible Causes, Typical Symptoms, Evaluation / Tests, ` +
          `Treatment Options, Self-Care and Lifestyle, Red Flags, Final Disclaimer.`;

        try {
          await bot.sendMessage(
            chatId,
            "📑 Generating your structured health report from the medical reference...",
            { parse_mode: "Markdown" }
          );

          const answer = await answerMedicalQuery(combinedQuery);
          const rawAnswer = String(answer);

          const reportText = buildReportText(rawAnswer, {
            name: form.name,
            age: form.age,
          });

          let reply = rawAnswer;
          if (reply.length > 4000) {
            reply =
              reply.slice(0, 3950) +
              "\n\n…report shortened for Telegram limit…";
          }
          reply = appendActions(reply);

          await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });

          const reportStream = reportTextToStream(reportText);
          await bot.sendDocument(
            chatId,
            reportStream,
            {},
            {
              filename: "health-report.txt",
              contentType: "text/plain",
            }
          );

          await bot.sendMessage(
            chatId,
            "✅ Your guided health report is complete.\n\n" +
              "To ask another question, use /quickconsult.\n" +
              "To start a new full report, use /healthreport again.",
            { parse_mode: "Markdown" }
          );
        } catch (err) {
          console.error(err);
          await bot.sendMessage(
            chatId,
            "⚠️ Error while generating the report. Please try again later.",
            { parse_mode: "Markdown" }
          );
        }

        return;
      }

      // fallback
      chatState.delete(chatId);
      await bot.sendMessage(
        chatId,
        "⚠️ Something went wrong. Send /healthreport to start again."
      );
      return;
    }

    // 2) Quick Consult (or default)
    if (!state || state.mode === "quick") {
      try {
        await bot.sendMessage(
          chatId,
          "*🔍 Quick Consult*\n_Analyzing your question in the medical reference..._",
          { parse_mode: "Markdown" }
        );

        const answer = await answerMedicalQuery(text);

        let reply = String(answer);
        if (reply.length > 4000) {
          reply =
            reply.slice(0, 3950) +
            "\n\n…answer shortened for Telegram length limit…";
        }

        reply = appendActions(reply);

        await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
      } catch (error) {
        console.error(error);
        await bot.sendMessage(
          chatId,
          "*⚠️ Temporary error*\n\n" +
            "Something went wrong while searching the medical database.\n" +
            "Please wait a minute and try again.\n\n" +
            "_If this is an emergency, do not wait for this bot. " +
            "Contact local emergency services or a doctor immediately._",
          { parse_mode: "Markdown" }
        );
      }
    }
  });

  return bot;
}
// CJS compatibility export (Vercel only)
globalThis.createBotCJS = createBot;
// FINAL EXPORTS - ONE TIME ONLY (KEEP THIS)
// ✅ botLogic.js BOTTOM - RE-EXPORT reportFile.js
// SINGLE CORRECT EXPORT BLOCK
export { answerMedicalQuery };
export { appendActions };
export { handleGreetings };
export { buildReportText, reportTextToStream } from "./reportFile.js";
