import OpenAI from "openai";
import "dotenv/config";

const client = new OpenAI({
  apiKey: process.env.ZG_COMPUTE_API_KEY,
  baseURL: process.env.ZG_COMPUTE_BASE_URL,
});

const res = await client.chat.completions.create({
  model: process.env.ZG_COMPUTE_MODEL,
  messages: [{ role: "user", content: "Reply with one word: ready" }],
});

console.log("0G Compute says:", res.choices[0].message.content);