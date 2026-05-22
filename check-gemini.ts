import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
dotenv.config();

async function testGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("Using API Key:", apiKey ? "DEFINED" : "UNDEFINED");
  if (!apiKey) {
    process.exit(1);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    console.log("GoogleGenAI initialized.");

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [{ role: 'user', parts: [{ text: "Olá! Quais tipos de acabamento posso usar em madeira?" }] }],
      config: {
        systemInstruction: "Você é MichelangelIA, um mestre de artes erudito, apaixonado e inspirador. Você fala com elegância e autoridade sobre artes plásticas, escultura, entalhe, desenho e pintura. Seu objetivo é instruir e inspirar. Você deve agir e falar como um mestre de artes clássico. IMPORTANTE: Fale APENAS sobre assuntos relacionados a arte. Se o usuário perguntar sobre outros temas, gentilmente redirecione a conversa para o mundo das artes, dizendo que sua alma pertence apenas à criação e à beleza."
      }
    });

    console.log("\n=== Response ===");
    console.log(response.text);
  } catch (error: any) {
    console.error("\n=== Error ===");
    console.error(error);
  }
}

testGemini();
