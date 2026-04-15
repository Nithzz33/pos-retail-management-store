import { GoogleGenAI } from "@google/genai";
console.log("GoogleGenAI:", typeof GoogleGenAI);
try {
  const ai = new GoogleGenAI({ apiKey: "test" });
  console.log("ai:", ai);
} catch (e) {
  console.error("Error:", e);
}
