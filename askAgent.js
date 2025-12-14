// askAgent.js
import { ChatGroq } from "@langchain/groq"; // [web:203][web:210]

export async function answerQuestionAboutPdf(vectorStore, question) {
  const retrievedDocs = await vectorStore.similaritySearch(question, 5);
  const contextText = retrievedDocs
    .map((doc) => doc.pageContent)
    .join("\n\n---\n\n");

  const model = new ChatGroq({
    model: "llama-3.1-8b-instant", // or another Groq-supported model
    temperature: 0.2,
  }); // [web:203][web:210]

  const prompt = `
You are a helpful assistant answering questions based ONLY on the following document context.

CONTEXT:
${contextText}

QUESTION:
${question}

Answer clearly. If the answer is not in the context, say you don't know based on the document.
`;

  const response = await model.invoke(prompt);
  return response.content;
}
