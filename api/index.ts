import express from "express";
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

dotenv.config();

const app = express();

app.use(express.json());

// Middleware to log incoming requests and responses to server.log for inspection
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const contentType = res.get("Content-Type") || "none";
    const logLine = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> Status: ${res.statusCode} | Type: ${contentType} | Time: ${duration}ms\n`;
    try {
      fs.appendFileSync(path.join(process.cwd(), "server.log"), logLine);
    } catch (err) {
      // Ignore log write errors
    }
    console.log(logLine.trim());
  });
  next();
});

// Define MIME types helper for common media files
const ARQUIVOS_MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon"
};

// Resilient middleware to resolve case-sensitivity, NFC/NFD encoding and whitespace issues for /arquivos/* files
app.get("/arquivos/*", (req, res, next) => {
  try {
    const originalPath = req.originalUrl.split("?")[0]; // e.g. "/arquivos/Apresenta%C3%A7%C3%A3o%20do%20Canal.jpg"
    const decodedPath = decodeURIComponent(originalPath); // e.g. "/arquivos/Apresentação do Canal.jpg"
    
    // Strip "/arquivos/" prefix to get the relative filename
    const cleanedFilename = decodedPath.replace(/^\/?arquivos\/?/, "").trim();

    if (!cleanedFilename) {
      return next();
    }

    const searchDirs = [
      path.join(process.cwd(), "public/arquivos"),
      path.join(process.cwd(), "dist/arquivos"),
      path.join(process.cwd(), "arquivos")
    ];

    // Helper to send file with robust cross-origin and caching headers
    const sendWithHeaders = (filePath: string, filename: string) => {
      try {
        const ext = path.extname(filename).toLowerCase();
        const contentType = ARQUIVOS_MIME_TYPES[ext] || "application/octet-stream";
        
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 year cache
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "*");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        
        // Force status 200 OK with whole payload to satisfy iframe sandboxing rules
        const fileBuffer = fs.readFileSync(filePath);
        return res.status(200).send(fileBuffer);
      } catch (err) {
        console.error("sendWithHeaders failed:", err);
        return res.status(404).send("File could not be transferred.");
      }
    };

    // 1. Direct Lookup Optimization: check if exact file exists first
    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const directPath = path.join(dir, cleanedFilename);
        if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
          return sendWithHeaders(directPath, cleanedFilename);
        }
      }
    }

    // 2. Resilient Directory Scan Fallback (Resolve case sensitivity, encoding variations)
    const reqNormalizedNFC = cleanedFilename.toLowerCase().normalize("NFC");
    const reqNormalizedNFD = cleanedFilename.toLowerCase().normalize("NFD");

    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        const matchedFile = files.find(f => {
          const fNormNFC = f.toLowerCase().normalize("NFC");
          const fNormNFD = f.toLowerCase().normalize("NFD");
          return fNormNFC === reqNormalizedNFC ||
                 fNormNFD === reqNormalizedNFD ||
                 fNormNFC === reqNormalizedNFD ||
                 fNormNFD === reqNormalizedNFC;
        });

        if (matchedFile) {
          const filePath = path.join(dir, matchedFile);
          if (fs.statSync(filePath).isFile()) {
            return sendWithHeaders(filePath, matchedFile);
          }
        }
      }
    }
  } catch (err) {
    console.error("Resilient /arquivos static served encountered an error:", err);
  }
  next();
});

// Servir arquivos estáticos de 'arquivos' de forma altamente resiliente (fallback)
app.use("/arquivos", express.static(path.join(process.cwd(), "public/arquivos")));
app.use("/arquivos", express.static(path.join(process.cwd(), "dist/arquivos")));
app.use("/arquivos", express.static(path.join(process.cwd(), "arquivos")));

// Helper to get SMTP transporter lazily and safely
function getSmtpTransporter() {
  const SMTP_USER = process.env.SMTP_USER || "andrewfmlemos@gmail.com";
  // Remove any spaces from the password to handle app credentials safely. No fallback to prevent credentials leaks.
  const SMTP_PASS = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

  if (!SMTP_PASS) {
    throw new Error("Erro de Configuração: A variável de ambiente 'SMTP_PASS' não está configurada! Por favor, adicione-a em suas Configurações (Settings -> Secrets).");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

function parseSMTPError(error: any): string {
  const SMTP_PASS = (process.env.SMTP_PASS || "").replace(/\s+/g, "");
  if (!SMTP_PASS) {
    return "Erro de Configuração: A variável de ambiente 'SMTP_PASS' não está configurada! Por favor, adicione-a em suas Configurações do AI Studio (Settings -> Secrets).";
  }
  if (!error) return "Erro desconhecido ao enviar e-mail pelo servidor SMTP.";
  if (error.code === 'EAUTH') {
    return "Erro de Autenticação SMTP (Gmail): Credenciais inválidas. Verifique se o e-mail e a Palavra-passe de Aplicação de 16 caracteres estão configurados corretamente nas Configurações (Settings -> Secrets).";
  }
  return error.message || String(error);
}

// API Health Check Route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", env: process.env.NODE_ENV || "unknown" });
});

// API Route to send the manual
app.post("/api/send-manual", async (req, res) => {
  const { email, name } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: "Email and name are required" });
  }

  try {
    const transporter = getSmtpTransporter();
    const SMTP_USER = process.env.SMTP_USER || "andrewfmlemos@gmail.com";
    
    await transporter.sendMail({
      from: `"Portfólio Andrew Lemos" <${SMTP_USER}>`,
      to: email,
      replyTo: SMTP_USER,
      subject: "Seu Manual de Entalhe em Madeira chegou! 🎨",
      html: `
        <div style="font-family: serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 20px;">
          <h1 style="color: #6d4c41;">Olá, ${name}!</h1>
          <p style="font-size: 16px; line-height: 1.6;">
            É um prazer compartilhar com você o meu <b>Manual de Introdução ao Entalhe em Madeira</b>.
          </p>
          <p style="font-size: 16px; line-height: 1.6;">
            Este guia foi preparado para ajudar você a dar os primeiros passos nesta arte milenar que tanto amo.
          </p>
          <div style="text-align: center; margin: 40px 0;">
            <a href="https://ais-dev-nszj23vldt2t4ag65mbgpx-81336736813.us-east1.run.app/arquivos/Manual%20de%20Instru%C3%A7%C3%A3o%20%E2%80%93%20Introdu%C3%A7%C3%A3o%20ao%20Entalhe%20em%20Madeira-1.pdf" 
               style="display: inline-block; background-color: #6d4c41; color: white; padding: 12px 24px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 14px;">
              Baixar Manual
            </a>
          </div>
          <p style="font-size: 14px; color: #666;">
            Se tiver qualquer dúvida sobre as técnicas ou sobre minhas aulas presenciais, sinta-se à vontade para responder este e-mail.
          </p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="text-align: center; font-style: italic; color: #8d6e63;">
            “Vi o anjo no mármore e esculpi até libertá-lo.”<br>
            <b>Michelangelo</b>
          </p>
        </div>
      `,
      text: `Olá ${name}, seu manual de entalhe chegou! Baixe aqui: https://ais-dev-nszj23vldt2t4ag65mbgpx-81336736813.us-east1.run.app/arquivos/Manual%20de%20Instru%C3%A7%C3%A3o%20%E2%80%93%20Introdu%C3%A7%C3%A3o%20ao%20Entalhe%20em%20Madeira-1.pdf`
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: parseSMTPError(error) });
  }
});

// API Route to handle contact form submissions securely via SMTP Gmail
app.post("/api/send-contact", async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: "Nome, e-mail e mensagem são campos obrigatórios." });
  }

  try {
    const transporter = getSmtpTransporter();
    const SMTP_USER = process.env.SMTP_USER || "andrewfmlemos@gmail.com";

    await transporter.sendMail({
      from: `"Portfólio Andrew Lemos de Contato" <${SMTP_USER}>`,
      to: "andrewfmlemos@gmail.com",
      replyTo: email,
      subject: `Mensagem de Contato: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e5e5e5; border-radius: 20px; background-color: #fbfbf9;">
          <h2 style="color: #8d6e63; border-bottom: 2px solid #8d6e63; padding-bottom: 10px; margin-top: 0; font-family: 'Georgia', serif;">Nova Mensagem do Portfólio</h2>
          <p style="font-size: 16px; margin: 15px 0; color: #555;">
            Você tem um novo contato de visitante interessado no seu trabalho de entalhe em madeira:
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 15px;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; width: 100px; color: #666;">Nome:</td>
              <td style="padding: 8px 0; color: #111; font-weight: bold;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #666;">E-mail:</td>
              <td style="padding: 8px 0; color: #111;"><a href="mailto:${email}" style="color: #8d6e63; text-decoration: underline;">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #666;">Assunto:</td>
              <td style="padding: 8px 0; color: #111;">${subject}</td>
            </tr>
          </table>

          <div style="background-color: #ffffff; padding: 20px; border-radius: 12px; border-left: 4px solid #8d6e63; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <h4 style="margin: 0 0 10px 0; color: #8d6e63; font-family: 'Georgia', serif; font-size: 14px; text-transform: uppercase; tracking: 0.05em;">Conteúdo da Mensagem:</h4>
            <p style="margin: 0; font-size: 15px; line-height: 1.6; white-space: pre-wrap; color: #222;">${message}</p>
          </div>

          <div style="text-align: center; margin: 30px 0 10px 0;">
            <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject)}" 
               style="background-color: #8d6e63; color: white; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 15px; display: inline-block; transition: background-color 0.2s;">
              RECONECTAR & RESPONDER AGORA
            </a>
          </div>

          <p style="font-size: 11px; color: #999; text-align: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;">
            Mensagem processada pelo servidor do seu Portfólio de Arte Online.
          </p>
        </div>
      `,
      text: `Nova Mensagem do Portfólio!\n\nNome: ${name}\nE-mail: ${email}\nAssunto: ${subject}\n\nMensagem:\n${message}\n\nResponder para: ${email}`
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error sending contact email via SMTP:", error);
    res.status(500).json({ error: parseSMTPError(error) });
  }
});

// API Route for secure Chatbot (Gemini)
app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("API Key GEMINI_API_KEY is missing in server environment variables!");
      return res.status(500).json({ error: "Chave do Gemini não configurada no servidor." });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [...(history || []), { role: 'user', parts: [{ text: message }] }],
      config: {
        systemInstruction: "Você é MichelangelIA, um mestre de artes erudito, apaixonado e inspirador. Você fala com elegância e autoridade sobre artes plásticas, escultura, entalhe, desenho e pintura. Seu objetivo é instruir e inspirar. Você deve agir e falar como um mestre de artes clássico. IMPORTANTE: Fale APENAS sobre assuntos relacionados a arte. Se o usuário perguntar sobre outros temas, gentilmente redirecione a conversa para o mundo das artes, dizendo que sua alma pertence apenas à criação e à beleza."
      }
    });

    res.json({ text: response.text || "" });
  } catch (error: any) {
    console.error("Erro no chat do servidor:", error);
    res.status(500).json({ error: error?.message || "Erro ao processar conversa." });
  }
});

export default app;
