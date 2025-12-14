import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const HF_TOKEN = process.env.HF_TOKEN; // set HF_TOKEN in your env

export async function describeImageEducational(imagePath) {
  try {
    // 1) Read local image and encode as base64 data URL
    const absPath = path.resolve(imagePath);
    const imageBuffer = fs.readFileSync(absPath);
    const imageBase64 = imageBuffer.toString("base64");
    const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

    // 2) Call HF OpenAI-compatible vision chat
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
                  image_url: {
                    url: dataUrl,
                  },
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

    return content.substring(0, 200).trim();
  } catch (error) {
    console.error("describeImageEducational error:", error);
    return "Image description unavailable - please describe your condition in text.";
  }
}
