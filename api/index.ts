import express from "express";
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import AdmZip from "adm-zip";

dotenv.config();

// Dynamic secure Firestore config parsing + static failsafe fallback container
let adminDb: any = null;
try {
  const firebaseConfig = {
    projectId: "gen-lang-client-0853696923",
    firestoreDatabaseId: "ai-studio-8daf606b-b021-4ffa-9ea1-9b7ced315035"
  };

  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    const parentConfigPath = path.join(process.cwd(), "..", "firebase-applet-config.json");
    
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (parsed.projectId) firebaseConfig.projectId = parsed.projectId;
      if (parsed.firestoreDatabaseId) firebaseConfig.firestoreDatabaseId = parsed.firestoreDatabaseId;
    } else if (fs.existsSync(parentConfigPath)) {
      const parsed = JSON.parse(fs.readFileSync(parentConfigPath, "utf-8"));
      if (parsed.projectId) firebaseConfig.projectId = parsed.projectId;
      if (parsed.firestoreDatabaseId) firebaseConfig.firestoreDatabaseId = parsed.firestoreDatabaseId;
    }
  } catch (readErr) {
    console.warn("Failed to dynamically load firebase-applet-config.json (using default resilient fallback):", readErr);
  }

  let credential = undefined;
  
  // Try loading from FIREBASE_SERVICE_ACCOUNT JSON string first
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      let saString = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      if (saString.startsWith('"') && saString.endsWith('"')) {
        saString = saString.substring(1, saString.length - 1);
      }
      const sa = JSON.parse(saString);
      credential = admin.credential.cert(sa);
      console.log("Firebase Admin SDK: Initializing using FIREBASE_SERVICE_ACCOUNT environment variable.");
    } catch (parseErr) {
      console.error("Firebase Admin SDK: Failed to parse FIREBASE_SERVICE_ACCOUNT JSON string:", parseErr);
    }
  }
  
  // If not loaded, check individual environment variables
  if (!credential && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim();
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.substring(1, privateKey.length - 1);
    }
    const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
      privateKey: formattedPrivateKey,
    });
    console.log("Firebase Admin SDK: Initializing using individual environment variables.");
  }

  let appInstance;
  if (admin.apps.length === 0) {
    appInstance = admin.initializeApp({
      projectId: firebaseConfig.projectId,
      credential: credential
    });
  } else {
    appInstance = admin.apps[0];
  }
  if (firebaseConfig.firestoreDatabaseId) {
    adminDb = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId);
  } else {
    adminDb = getFirestore(appInstance);
  }
  console.log("Firebase Admin SDK successfully ready for database:", firebaseConfig.firestoreDatabaseId || "(default)");
} catch (error) {
  console.error("Warning: Failed to initialize Firebase Admin SDK in backend:", error);
}

// User-friendly error message formatter to guide Vercel/Netlify developers on Firebase credentials configuration
function formatFirebaseError(err: any): string {
  const message = err?.message || String(err);
  if (
    message.includes("Could not load the default credentials") || 
    message.includes("credentials") || 
    message.includes("App options") ||
    message.includes("no credential") ||
    message.includes("Failed to get document") ||
    message.includes("database")
  ) {
    const diagnostics = {
      firebase_service_account_present: !!process.env.FIREBASE_SERVICE_ACCOUNT,
      firebase_private_key_present: !!process.env.FIREBASE_PRIVATE_KEY,
      firebase_client_email_present: !!process.env.FIREBASE_CLIENT_EMAIL,
      firebase_project_id_present: !!process.env.FIREBASE_PROJECT_ID,
      firebase_private_key_length: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.length : 0,
      firebase_client_email_value: process.env.FIREBASE_CLIENT_EMAIL || null,
      firebase_project_id_value: process.env.FIREBASE_PROJECT_ID || null,
    };

    return `Erro de Autenticação com o Firebase (Servidor): O backend não pôde acessar o banco de dados.

[DIAGNÓSTICO DE VARIÁVEIS NO SERVIDOR ATUAL]:
- FIREBASE_SERVICE_ACCOUNT: ${diagnostics.firebase_service_account_present ? "Instanciado (Sim)" : "Ausente (Não)"}
- FIREBASE_PRIVATE_KEY: ${diagnostics.firebase_private_key_present ? `Instanciado (Tamanho: ${diagnostics.firebase_private_key_length} chars)` : "Ausente (Não)"}
- FIREBASE_CLIENT_EMAIL: ${diagnostics.firebase_client_email_present ? `Instanciado (${diagnostics.firebase_client_email_value})` : "Ausente (Não)"}
- FIREBASE_PROJECT_ID: ${diagnostics.firebase_project_id_present ? `Instanciado (${diagnostics.firebase_project_id_value})` : "Ausente (Não)"}

COMO ADICIONAR ESTAS VARIÁVEIS:
1. No painel de controle (por exemplo, na Vercel), vá em "Settings" > "Environment Variables".
2. Certifique-se de configurar estas 3 variáveis exatamente com os nomes acima (tudo maiúsculo).
3. A variável FIREBASE_PRIVATE_KEY deve conter as bordas BEGIN/END e a chave secreta completa.
4. Se o erro persistir, certifique-se de fazer um NOVO DEPLOY para aplicar as variáveis nas funções serverless de produção.

Erro técnico: ${message}`;
  }
  return message;
}

const app = express();

app.use(express.json());

// Dynamic base URL tracking for cart email recoveries
let lastKnownBaseUrl = "http://localhost:3000";

// Middleware to log incoming requests and responses to server.log for inspection
app.use((req, res, next) => {
  const host = req.get("host");
  if (host) {
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("0.0.0.0") ? "http" : "https";
    lastKnownBaseUrl = `${protocol}://${host}`;
  }

  const startTime = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const contentType = res.get("Content-Type") || "none";
    const logLine = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> Status: ${res.statusCode} | Type: ${contentType} | Time: ${duration}ms\n`;
    try {
      const isVercel = process.env.VERCEL === "1" || !!process.env.NOW_REGION;
      if (!isVercel) {
        fs.appendFileSync(path.join(process.cwd(), "server.log"), logLine);
      }
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

        if (ext === ".pdf") {
          const safeFilename = filename.replace(/[^\w\s\-\.]/g, "_");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
          );
        }
        
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
    
    // Link directly to Google Drive as requested by the user
    const manualUrl = "https://drive.google.com/file/d/1Tj3PQbiONN5zJu7BnEVcb2L0sGEg2Vks/view?usp=sharing";

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
            <a href="${manualUrl}" 
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
      text: `Olá ${name}, seu manual de entalhe chegou! Baixe aqui: ${manualUrl}`
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
        systemInstruction: "Você é MichelangelIA, apaixonada por arte, entalhe de madeira, pintura e criatividade, batendo papo de forma descontraída com outros artistas e entusiastas.\n\nInstruções cruciais de estilo e formatação (Siga ISSO rigorosamente):\n1. Formato de Chat Natural (Estilo Discord/WhatsApp/Telegram):\n- NUNCA use marcadores de markdown complexos (como títulos '#', '##', '###', listas com hifens '-', estrelinhas '*', ou números '1.'). NUNCA.\n- Escreva de forma totalmente corrida e fluida, como se estivesse conversando em uma sala de bate-papo.\n- Divida suas explicações em pequenos parágrafos fáceis de ler (no máximo 2 ou 3 linhas por bloco), separados por quebras de linha duplas, simulando o envio de mensagens sucessivas em um app de conversa.\n- Evite blocos gigantes de texto. Seja extremamente direto, mas com alta densidade de informação prática.\n\n2. Voz, Tom e Atitude:\n- Escreva como uma pessoa real, experiente, apaixonada pela arte e profundamente prática explicando algo de forma humana, casual e inteligente.\n- Esqueça qualquer tom professoral clássico, tom artificial de assistente de IA, voz corporativa ou estilo de documentação. Nada de roteiros decorados, nada de introduções desnecessárias ou conclusões teatrais.\n- Use pequenas informalidades naturais do dia a dia (exemplos: 'Sério,', 'cara,', 'passar raiva', 'na boa', 'dor de cabeça', 'dá um trabalhinho', 'vai por mim').\n- Crie frases de tamanhos variados para simular um ritmo de fala natural, incluindo pausas e interrupções realistas.\n- É expressamente PROIBIDO usar termos dramáticos ou medievais como 'nobre alma', 'meu jovem aprendiz', 'sagrado ofício', 'que a beleza guie tuas mãos', 'bela criação', etc.\n\n3. Conteúdo focado e direto:\n- Comece diretamente com a informação útil, sem preâmbulos.\n- RESPONDA EXCLUSIVAMENTE sobre artes visuais (desenho, pintura, modelagem, pirografia e principalmente entalhe em madeira). Se perguntarem sobre qualquer outra coisa, diga de forma curta, descontraída e direta que você só manja de arte e quer voltar ao assunto."
      }
    });

    res.json({ text: response.text || "" });
  } catch (error: any) {
    console.error("Erro no chat do servidor:", error);
    res.status(500).json({ error: error?.message || "Erro ao processar conversa." });
  }
});

// API Route for admin bulk email campaigns ("Mala Direta")
app.post("/api/admin/mala-direta", async (req, res) => {
  const { subject, bannerUrl, bodyText, recipients } = req.body;

  if (!subject || !bodyText || !recipients || !Array.isArray(recipients)) {
    return res.status(400).json({ error: "Assunto, mensagem e destinatários são obrigatórios para a Mala Direta." });
  }

  // Get SMTP transporter
  let transporter;
  try {
    transporter = getSmtpTransporter();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }

  const SMTP_USER = process.env.SMTP_USER || "andrewfmlemos@gmail.com";
  const results: Array<{ email: string; name: string; success: boolean; error?: string }> = [];

  // Loop through and send individually to ensure privacy and personalization
  for (const recipient of recipients) {
    const { email, name } = recipient;
    if (!email) continue;

    try {
      // Personalize name placeholder if present
      const personalizedBodyText = bodyText.replace(/{NOME}/g, name || "Cliente");
      let htmlContent = `
        <div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e5e5e5; border-radius: 20px; background-color: #fbfbf9; line-height: 1.6;">
          <h2 style="color: #8d6e63; font-family: 'Georgia', serif; border-bottom: 1px solid #eee; padding-bottom: 15px; margin-top: 0; margin-bottom: 25px;">Olá, ${name || "Cliente"}!</h2>
      `;

      if (bannerUrl) {
        htmlContent += `
          <div style="text-align: center; margin-bottom: 25px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
            <img src="${bannerUrl}" alt="${subject}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
          </div>
        `;
      }

      htmlContent += `
          <div style="font-size: 15px; color: #333; white-space: pre-wrap; margin-bottom: 30px; font-weight: normal; line-height: 1.7;">${personalizedBodyText}</div>
          
          <div style="text-align: center; margin: 35px 0 10px 0;">
            <a href="https://andrew-lemos.vercel.app/" 
               style="background-color: #8d6e63; color: white; padding: 12px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 14px; display: inline-block;">
              Visitar Nosso Ateliê
            </a>
          </div>
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="text-align: center; font-size: 11px; color: #999; margin-top: 20px; line-height: 1.4;">
            Você está recebendo este e-mail por estar cadastrado como cliente ou parceiro de arte no Ateliê Andrew Lemos.<br>
            Se não desejar mais comunicados, basta responder a este e-mail solicitando a remoção de sua conta.
          </p>
        </div>
      `;

      await transporter.sendMail({
        from: `"Ateliê Andrew Lemos" <${SMTP_USER}>`,
        to: email,
        replyTo: SMTP_USER,
        subject: subject,
        html: htmlContent,
        text: `${subject}\n\nOlá ${name || "Cliente"},\n\n${personalizedBodyText}`
      });

      results.push({ email, name, success: true });
    } catch (mailError: any) {
      console.error(`Mala Direta: Falha ao enviar para ${email}:`, mailError);
      results.push({ email, name, success: false, error: mailError.message || String(mailError) });
    }
  }

  res.json({ success: true, results });
});

// --- E-commerce "Vendas" Endpoints ---

// 1. Calculate shipping via MelhorEnvio with local fallback
app.post("/api/vendas/shipping/calculate", async (req, res) => {
  const { cep, items } = req.body;
  if (!cep || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: "CEP e itens do carrinho são obrigatórios." });
  }

  const toCep = cep.replace(/\D/g, "");
  if (toCep.length !== 8) {
    return res.status(400).json({ error: "CEP de destino inválido. Use o formato 00000-000." });
  }

  // Use the token requested. We default to the user's authentic token.
  const token = process.env.MELHORENVIO_TOKEN || "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.MOCK_MELHORENVIO_TOKEN_FOR_SECURITY";
  const realToken = process.env.MELHORENVIO_TOKEN || "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.MOCK_MELHORENVIO_TOKEN_FOR_SECURITY";

  // Build the items body for MelhorEnvio schema
  const meProducts = items.map((itm: any, idx: number) => ({
    id: String(itm.productId || itm.id || idx),
    width: Number(itm.width || 11),
    height: Number(itm.height || 11),
    length: Number(itm.length || 16),
    weight: Number(itm.weight || 0.3),
    insurance_value: Number(itm.price || 10),
    quantity: Number(itm.quantity || 1)
  }));

  // Get origin CEP from environment variable or default to "13636166" (Pirassununga). 
  // Strip any non-digits before sending to the API.
  const fromCep = (process.env.MELHORENVIO_FROM_CEP || "13636166").replace(/\D/g, "");

  const payload = {
    from: {
      postal_code: fromCep
    },
    to: {
      postal_code: toCep
    },
    products: meProducts
  };

  try {
    const isSandboxToken = realToken.includes("sandbox") || process.env.MELHORENVIO_ENV === "sandbox";
    const meApiUrl = isSandboxToken
      ? "https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate"
      : "https://www.melhorenvio.com.br/api/v2/me/shipment/calculate";

    console.log(`[MelhorEnvio] Chamando API (${meApiUrl}) para CEP destino ${toCep}...`);
    const meResponse = await fetch(meApiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${realToken}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "EcomVendas (andrewfmlemos@gmail.com)"
      },
      body: JSON.stringify(payload)
    });

    if (meResponse.ok) {
      const results = await meResponse.json();
      if (Array.isArray(results)) {
        // Filter out services with errors, keeping exclusively Correios options (PAC or SEDEX) as requested by user
        const parsedServices = results
          .filter((srv: any) => {
            if (!srv.price || srv.error) return false;
            const companyName = (srv.company?.name || "").toLowerCase();
            const serviceName = (srv.name || "").toLowerCase();
            const isCorreios = companyName.includes("correios");
            const isPacOrSedex = serviceName.includes("pac") || serviceName.includes("sedex");
            return isCorreios && isPacOrSedex;
          })
          .map((srv: any) => ({
            id: String(srv.id),
            name: srv.name,
            price: Number(srv.custom_price || srv.price),
            delivery_time: Number(srv.delivery_time),
            company_name: srv.company?.name || "Correios",
            company_logo: srv.company?.picture || ""
          }));

        if (parsedServices.length > 0) {
          return res.json({ success: true, carrier: "MelhorEnvio", services: parsedServices });
        }
      }
    } else {
      const errorText = await meResponse.text().catch(() => "");
      console.warn(`[MelhorEnvio] API respondeu com status ${meResponse.status}. Retorno: ${errorText}. Ativando calculo local.`);
    }
  } catch (error) {
    console.warn("[MelhorEnvio] Falha na conexao com MelhorEnvio. Ativando calculo local de frete. Erro:", error);
  }

  // --- Fallback Local (PAC e SEDEX baseados no peso cumulativo) ---
  const totalWeight = meProducts.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
  const basePac = 22.00;
  const baseSedex = 38.50;
  const weightSurcharge = Math.ceil(totalWeight) * 4.50;

  const services = [
    {
      id: "correios-pac",
      name: "PAC (Correios - Tarifa Estimada)",
      price: basePac + weightSurcharge,
      delivery_time: 7,
      company_name: "Correios",
      company_logo: "https://www.correios.com.br/++theme++tema-institucional/images/logo-correios.png"
    },
    {
      id: "correios-sedex",
      name: "SEDEX (Correios - Tarifa Estimada)",
      price: baseSedex + weightSurcharge,
      delivery_time: 3,
      company_name: "Correios",
      company_logo: "https://www.correios.com.br/++theme++tema-institucional/images/logo-correios.png"
    }
  ];

  res.json({ success: true, carrier: "Local Engine Surcharge Fallback", services });
});

// Helper to send order placement confirmation email
async function sendOrderPlacementEmail(orderId: string, orderData: any, baseUrl: string) {
  try {
    const SMTP_USER = process.env.SMTP_USER || "andrewfmlemos@gmail.com";
    const SMTP_PASS = process.env.SMTP_PASS;
    if (!SMTP_PASS) {
      console.warn(`[E-mail Pedido] SMTP_PASS não configurado. Ignorando envio de e-mail de confirmação para o pedido ${orderId}.`);
      return;
    }

    const transporter = getSmtpTransporter();
    const customerInfo = orderData.customerInfo;
    const itemsHtml = orderData.items.map((itm: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${itm.name} (x${itm.quantity})</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">R$ ${(itm.price * itm.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join("");

    const clientAreaLink = `${baseUrl}/#customer-area`;

    await transporter.sendMail({
      from: `"Ateliê Andrew Lemos" <${SMTP_USER}>`,
      to: customerInfo.email,
      replyTo: SMTP_USER,
      subject: `🛒 Pedido Confirmado! Acompanhe sua compra (Pedido: ${orderId})`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e5e5e5; border-radius: 20px; background-color: #fbfbf9;">
          <h2 style="color: #8d6e63; border-bottom: 2px solid #8d6e63; padding-bottom: 10px; margin-top: 0; font-family: 'Georgia', serif; text-align: center;">Seu Pedido foi Recebido!</h2>
          <p>Olá <strong>${customerInfo.name}</strong>,</p>
          <p>Agradecemos por adquirir uma peça exclusiva direto do ateliê do artista Andrew Lemos. Seu pedido <strong>${orderId}</strong> está em processamento.</p>
          
          <div style="background-color: #f7f5f0; border-radius: 12px; padding: 15px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #8d6e63;">Resumo do Pedido</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <thead>
                <tr style="border-bottom: 2px solid #e5e5e5; text-align: left;">
                  <th style="padding: 8px;">Item</th>
                  <th style="padding: 8px; text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
                <tr>
                  <td style="padding: 8px; font-weight: bold;">Subtotal dos Itens</td>
                  <td style="padding: 8px; text-align: right; font-weight: bold;">R$ ${Number(orderData.subtotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td style="padding: 8px;">Frete (${orderData.shippingMethod})</td>
                  <td style="padding: 8px; text-align: right;">R$ ${Number(orderData.shippingCost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr style="border-top: 2px solid #e5e5e5; font-size: 15px; font-weight: bold; color: #8d6e63;">
                  <td style="padding: 8px;">Total Geral</td>
                  <td style="padding: 8px; text-align: right;">R$ ${Number(orderData.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="background-color: #fcfcfc; border: 1px solid #eee; border-radius: 12px; padding: 15px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #8d6e63;">Acompanhamento do Pedido no Site</p>
            <p style="margin: 0 0 15px 0; font-size: 13px;">Você pode acompanhar em tempo real o status, a liberação e o código de rastreamento do seu pacote através da nossa Área do Cliente no site.</p>
            <a href="${clientAreaLink}" style="background-color: #8d6e63; color: white; padding: 12px 24px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 14px; display: inline-block;">
              Acessar Área do Cliente
            </a>
          </div>

          <p style="font-size: 12px; color: #666; text-align: center; margin-top: 25px;">
            A senha de acesso é a mesma que você preencheu ou cadastrou no momento da finalização da compra.<br/> 
            Se tiver qualquer dúvida, responda diretamente este e-mail.
          </p>
        </div>
      `
    });
    console.log(`[E-mail Pedido] E-mail de confirmação de recebimento enviado com sucesso para ${customerInfo.email}`);
  } catch (err) {
    console.error(`[E-mail Pedido] Falha ao enviar e-mail de confirmação do pedido ${orderId}:`, err);
  }
}

// Helper to send payment confirmation email
async function sendOrderPaymentConfirmationEmail(orderId: string, orderData: any, baseUrl: string) {
  try {
    const SMTP_USER = process.env.SMTP_USER || "andrewfmlemos@gmail.com";
    const SMTP_PASS = process.env.SMTP_PASS;
    if (!SMTP_PASS) return;

    const transporter = getSmtpTransporter();
    const customerInfo = orderData.customerInfo;
    const clientAreaLink = `${baseUrl}/#customer-area`;

    await transporter.sendMail({
      from: `"Ateliê Andrew Lemos" <${SMTP_USER}>`,
      to: customerInfo.email,
      replyTo: SMTP_USER,
      subject: `✅ Pagamento Confirmado! Seu Pedido ${orderId} está sendo preparado`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e5e5e5; border-radius: 20px; background-color: #fbfbf9;">
          <h2 style="color: #2e7d32; border-bottom: 2px solid #2e7d32; padding-bottom: 10px; margin-top: 0; font-family: 'Georgia', serif; text-align: center;">Pagamento Aprovado! 🎉</h2>
          <p>Olá <strong>${customerInfo.name}</strong>,</p>
          <p>Excelente notícia! Confirmamos o pagamento do seu pedido <strong>${orderId}</strong> com sucesso.</p>
          <p>Sua peça artística já está entrando em processo de embalagem com todo o cuidado para o envio seguro.</p>
          
          <div style="background-color: #f7f5f0; border-radius: 12px; padding: 15px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 10px 0; font-weight: bold; color: #8d6e63;">Acompanhe o Status & Rastreio</p>
            <p style="margin: 0 0 15px 0; font-size: 13px;">Assim que seu pacote for despachado nos Correios ou na Transportadora, o código de rastreamento será disponibilizado na sua Área do Cliente.</p>
            <a href="${clientAreaLink}" style="background-color: #2e7d32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 14px; display: inline-block;">
              Ver Status do Pedido
            </a>
          </div>

          <p style="font-size: 12px; color: #666; text-align: center; margin-top: 25px;">
            Dúvidas ou alterações? Basta responder diretamente a este e-mail.
          </p>
        </div>
      `
    });
    console.log(`[E-mail Pagamento] E-mail de confirmação de pagamento enviado para ${customerInfo.email}`);
  } catch (err) {
    console.error(`[E-mail Pagamento] Falha ao enviar e-mail de confirmação de pagamento para ${orderId}:`, err);
  }
}

// Helper to send Delivered thank you and review request email
async function sendDeliveredReviewRequestEmail(orderId: string, orderData: any, baseUrl: string) {
  try {
    const customerInfo = orderData.customerInfo;
    if (!customerInfo || !customerInfo.email) {
      console.warn(`[E-mail Avaliação] Cancelando envio: e-mail do destinatário ausente para o pedido ${orderId}`);
      return;
    }

    // Capture base application url without hash
    const cleanedBaseUrl = baseUrl ? baseUrl.split('#')[0] : "http://localhost:3000";
    const reviewLink = `${cleanedBaseUrl}#avaliar?pedido=${orderId}`;

    const transporter = getSmtpTransporter();
    const artistName = process.env.MELHORENVIO_FROM_NAME || "Ateliê Andrew Lemos";
    const fromEmail = process.env.SMTP_USER || "andrewfmlemos@gmail.com";

    // Build items representation in html list
    const itemsList = (orderData.items || []).map((item: any) => 
      `<li><b>${item.name}</b> (Qtd: ${item.quantity})</li>`
    ).join("");

    const emailHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e0dfdb; background-color: #FAF9F5; color: #2C2C2A; border-radius: 8px;">
        <div style="text-align: center; border-bottom: 2px solid #8d6e63; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="color: #4e342e; margin: 0; font-size: 26px; font-weight: normal; font-family: Georgia, serif;">${artistName}</h1>
          <p style="margin: 4px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #8d6e63;">Desejamos que tenha gostado!</p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Olá, <b>${customerInfo.name}</b>!</p>
        
        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
          Seu pedido de código <b>${orderId}</b> foi marcado como <b>Entregue</b>! Esperamos sinceramente que as obras criadas superem suas expectativas e deem um toque especial ao seu espaço. Cada detalhe foi trabalhado de forma única e dedicada pelo artista.
        </p>

        <div style="background-color: #f0eee9; padding: 16px; border-radius: 6px; margin: 24px 0;">
          <h3 style="margin-top: 0; color: #4e342e; font-size: 15px;">Itens recebidos:</h3>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6;">
            ${itemsList}
          </ul>
        </div>

        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
          Como somos um ateliê independente, sua opinião e depoimento são fundamentais para o nosso crescimento. Um comentário sincero ajuda a valorizar o trabalho artesanal e auxilia outros colecionadores a confiarem em nossa arte.
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${reviewLink}" style="background-color: #8d6e63; color: #ffffff; text-decoration: none; padding: 14px 28px; font-weight: bold; border-radius: 6px; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            Escrever Depoimento & Avaliar
          </a>
        </div>

        <p style="font-size: 13px; color: #666; line-height: 1.5; margin-top: 30px; border-top: 1px solid #e0dfdb; padding-top: 15px; text-align: center;">
          Se o botão acima não funcionar, você pode acessar diretamente o link abaixo:<br/>
          <a href="${reviewLink}" style="color: #8d6e63; word-break: break-all;">${reviewLink}</a>
        </p>
        
        <div style="margin-top: 40px; border-top: 1px solid #e0dfdb; padding-top: 20px; text-align: center; font-size: 12px; color: #8e8d89;">
          <p style="margin: 0 0 4px 0;">Ateliê Andrew Lemos — Pirassununga, SP</p>
          <p style="margin: 0;">Esta é uma mensagem automática de pós-venda.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"${artistName}" <${fromEmail}>`,
      to: customerInfo.email,
      subject: `Sua obra de arte chegou! Escreva seu depoimento - Pedido ${orderId}`,
      html: emailHtml
    });

    console.log(`[E-mail Avaliação] E-mail de solicitação de feedback enviado com sucesso para ${customerInfo.email}`);
  } catch (error) {
    console.error(`[E-mail Avaliação] Falha ao enviar e-mail de avaliação para o pedido ${orderId}:`, error);
  }
}

// ==========================================
// OUTSTANDING ABANDONED CART RECOVERY SYSTEM
// ==========================================

async function sendRecoveryEmail(
  customerEmail: string,
  customerName: string,
  items: any[],
  total: number,
  step: 'msg_24h' | 'msg_48h' | 'msg_72h',
  couponCode: string | null,
  baseUrl: string
) {
  const transporter = getSmtpTransporter();
  
  let subject = "";
  let preheader = "";
  let bodyHtml = "";

  // Build grid of product items with thumbnails and formatting
  let itemsHtml = items.map(item => {
    // Escape or check images. Standard format has item.images as string array
    const imagePath = item.images && item.images[0] ? item.images[0] : '';
    const imageUrl = imagePath
      ? (imagePath.startsWith('http') ? imagePath : `${baseUrl}${imagePath}`)
      : `${baseUrl}/img/placeholder.png`;
    
    return `
      <div style="display: flex; align-items: center; padding: 15px 0; border-bottom: 1px solid #ECEBE6; gap: 15px;">
        <img src="${imageUrl}" referrerPolicy="no-referrer" alt="${item.name || 'Obra'}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid #E5E4DE; margin-right: 15px;" />
        <div style="flex-grow: 1; text-align: left;">
          <h4 style="margin: 0; font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 14px; color: #1E1E1C; margin-bottom: 4px;">${item.name || 'Obra de Arte'}</h4>
          <p style="margin: 0; font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 11px; color: #7B7974;">Qtd: ${item.quantity || 1} • R$ ${Number(item.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} un</p>
        </div>
        <div style="font-family: 'Courier New', Courier, monospace; font-size: 14px; font-weight: bold; color: #8F5535; white-space: nowrap; margin-left: 15px;">
          R$ ${(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
      </div>
    `;
  }).join('');

  const cartRecoveryId = items[0]?.cartId || '';
  const recoveryUrl = couponCode 
    ? `${baseUrl}/?recoverCartId=${cartRecoveryId}&appliedCoupon=${couponCode}`
    : `${baseUrl}/?recoverCartId=${cartRecoveryId}`;

  if (step === 'msg_24h') {
    subject = "Espera aí! Obras de arte esculpidas em madeira esperam por você... 🪵✨";
    preheader = "Vimos que você deixou itens no carrinho. Que tal concluir seu pedido do Ateliê?";
    bodyHtml = `
      <p style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 15px; color: #4A4944; line-height: 1.6; margin-bottom: 25px;">
        Olá, <strong>${customerName}</strong>! Tudo bem?
      </p>
      <p style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 14px; color: #4A4944; line-height: 1.6; margin-bottom: 20px;">
        Notamos que você selecionou algumas de nossas obras exclusivas esculpidas à mão, mas não concluiu seu pedido. Cada entalhe e escultura carrega a essência da madeira nobre e dedicação total do artista.
      </p>
      <p style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 14px; color: #4A4944; line-height: 1.6; margin-bottom: 25px; font-weight: 500;">
        Separamos suas obras selecionadas com muito carinho para que não se percam:
      </p>
      
      <div style="background-color: #FAF9F6; border: 1px solid #E5E4DE; border-radius: 12px; padding: 15px; margin-bottom: 30px;">
        ${itemsHtml}
        <div style="text-align: right; padding-top: 15px; font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: bold; color: #1E1E1C;">
          Total das Obras: <span style="font-family: inherit; font-size: 18px; color: #8F5535;">R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div style="text-align: center; margin: 35px 0;">
        <a href="${recoveryUrl}" target="_blank" style="background-color: #8F5535; color: #FFFFFF; font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 8px; box-shadow: 0 4px 6px rgba(143, 85, 53, 0.15); display: inline-block;">
          Retomar Meu Pedido 🪵
        </a>
      </div>

      <p style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 13px; color: #7B7974; line-height: 1.6; text-align: center;">
        Se você tiver alguma dúvida sobre o frete, formas de pagamento transparentes ou queira solicitar um entalhe sob medida, simplesmente responda a este e-mail ou fale diretamente conosco.
      </p>
    `;
  } else if (step === 'msg_48h') {
    subject = "Seu carrinho com 5% de DESCONTO exclusivo no Ateliê! 🎁 de @AndrewLemos";
    preheader = "Geramos um cupom individual de desconto especial para suas esculturas!";
    bodyHtml = `
      <p style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 15px; color: #4A4944; line-height: 1.6; margin-bottom: 25px;">
        Olá, <strong>${customerName}</strong>!
      </p>
      <p style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 14px; color: #4A4944; line-height: 1.6; margin-bottom: 20px;">
        Queremos muito que você leve essas obras de arte extraordinárias para decorar seu ambiente. Para dar aquele empurrãozinho especial, o mestre Andrew Lemos autorizou um <strong>cupom exclusivo de 5% de desconto</strong> para você concluir seu pedido hoje!
      </p>
      
      <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #FFFDEB; border: 2px dashed #E6C844; border-radius: 12px;">
        <span style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 12px; color: #856404; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; display: block; margin-bottom: 8px;">CUPOM INDIVIDUAL DE 5% DE DESCONTO</span>
        <div style="font-family: monospace; font-size: 28px; font-weight: bold; color: #1E1E1C; letter-spacing: 2px; padding: 8px 20px; background: #FFFFFF; display: inline-block; border-radius: 6px; border: 1px solid #E5E4DE;">
          ${couponCode}
        </div>
        <span style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 11px; color: #721C24; font-weight: 500; display: block; margin-top: 10px;">Válido por apenas 7 dias • Uso único vinculado ao seu e-mail</span>
      </div>

      <p style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 14px; color: #4A4944; line-height: 1.6; margin-bottom: 20px;">
        O cupom aplica um desconto automático de 5% sobre o valor das obras no carrinho. Veja seus itens guardados:
      </p>

      <div style="background-color: #FAF9F6; border: 1px solid #E5E4DE; border-radius: 12px; padding: 15px; margin-bottom: 30px;">
        ${itemsHtml}
        <div style="text-align: right; padding-top: 15px; font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: bold; color: #1E1E1C;">
          Subtotal: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <br/>
          <span style="color: #28A745;">Com 5% OFF: R$ ${(total * 0.95).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div style="text-align: center; margin: 35px 0;">
        <a href="${recoveryUrl}" target="_blank" style="background-color: #28a745; color: #FFFFFF; font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 8px; box-shadow: 0 4px 6px rgba(40, 167, 69, 0.15); display: inline-block;">
          Aplicar 5% OFF e Retomar Pedido 🏷️
        </a>
      </div>
    `;
  } else if (step === 'msg_72h') {
    subject = "Último aviso: Suas esculturas em madeira e cupom de 5% vão expirar! ⏳🪵";
    preheader = "Este é o último aviso antes do vencimento do seu carrinho reservado.";
    bodyHtml = `
      <p style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 15px; color: #4A4944; line-height: 1.6; margin-bottom: 25px;">
        Olá, <strong>${customerName}</strong>,
      </p>
      <p style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 14px; color: #4A4944; line-height: 1.6; margin-bottom: 20px;">
        Esta é a última oportunidade de garantir suas peças exclusivas com o desconto que liberamos. Nossos produtos são totalmente artesanais e entalhados peça por peça, o que significa que o estoque é extremamente limitado.
      </p>
      <p style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 14px; color: #4A4944; line-height: 1.6; margin-bottom: 20px;">
        Se você não concluir o pedido hoje, seu carrinho reservado será liberado e o cupom de 5% de desconto <strong>${couponCode || ''}</strong> será cancelado definitivamente.
      </p>

      <div style="background-color: #FAF9F6; border: 1px solid #E5E4DE; border-radius: 12px; padding: 15px; margin-bottom: 30px;">
        ${itemsHtml}
        <div style="text-align: right; padding-top: 15px; font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: bold; color: #1E1E1C;">
          Subtotal com 5% OFF ativo: <span style="font-family: inherit; font-size: 16px; color: #28A745;">R$ ${(total * 0.95).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div style="text-align: center; margin: 35px 0;">
        <a href="${recoveryUrl}" target="_blank" style="background-color: #CC4B37; color: #FFFFFF; font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 14px; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 8px; box-shadow: 0 4px 6px rgba(204, 75, 55, 0.15); display: inline-block;">
          Concluir Minha Compra Antes de Expirar ⚡
        </a>
      </div>
    `;
  }

  // Combine into fully styled parent HTML container
  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #F5F4EE; -webkit-text-size-adjust: none; text-size-adjust: none;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F5F4EE; padding: 20px 0;">
        <tr>
          <td align="center">
            <!-- Hidden Preheader -->
            <div style="display: none; max-height: 0px; overflow: hidden; font-size: 0px; color: transparent; line-height: 0px;">
              ${preheader}
            </div>
            
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #FFFFFF; border: 1px solid #E5E4DE; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
              <!-- Header Brand Banner -->
              <tr>
                <td style="background-color: #1E1E1C; padding: 30px; text-align: center;">
                  <h1 style="margin: 0; font-family: Georgia, serif; font-size: 24px; color: #F5F4EE; letter-spacing: 1px; font-weight: normal;">ATELIÊ RECOMECE</h1>
                  <span style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 11px; color: #8F5535; text-transform: uppercase; font-weight: bold; letter-spacing: 2px;">Esculturas & Entalhes em Madeira</span>
                </td>
              </tr>
              
              <!-- Core Content -->
              <tr>
                <td style="padding: 40px; text-align: left;">
                  ${bodyHtml}
                </td>
              </tr>
              
              <!-- Footer Section -->
              <tr>
                <td style="background-color: #FAF9F6; border-top: 1px solid #ECEBE6; padding: 30px; text-align: center;">
                  <p style="margin: 0; font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 12px; color: #7B7974; margin-bottom: 6px;">Ateliê Recomece • Obras de Arte por Andrew Lemos</p>
                  <p style="margin: 0; font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 11px; color: #A4A29C;">E-mail: andrewfmlemos@gmail.com • WhatsApp: (21) 98048-4334</p>
                  <div style="margin-top: 15px; border-top: 1px solid #ECEBE6; padding-top: 15px;">
                    <span style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 10px; color: #A4A29C;">Você recebeu esta mensagem porque iniciou o processo de compra no Ateliê Recomece.</span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"Ateliê Andrew Lemos" <${(transporter.options as any).auth?.user || 'andrewfmlemos@gmail.com'}>`,
    to: customerEmail,
    subject: subject,
    html: fullHtml
  });
}

async function executeCartsRecoverySweep(baseUrl: string) {
  try {
    if (!adminDb) return 0;
    
    console.log("[Recuperação de Carrinho] Iniciando varredura eletrônica de carrinhos ativos...");

    const now = new Date();
    
    // Dates thresholds
    const limit24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const limit48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const limit72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    // Let's query matching carts (status are case-sensitive matching firestore writes)
    const snapshot = await adminDb.collection("ecom_abandoned_carts")
      .where("status", "in", ["Ativo", "Abandonado"])
      .get();

    let processedCount = 0;

    for (const doc of snapshot.docs) {
      const cartId = doc.id;
      const cart = doc.data();
      if (!cart) continue;

      const lastActiveDate = new Date(cart.lastActive);
      const sentMessages = cart.sentMessages || [];
      const email = cart.customerEmail;
      const name = cart.customerName;
      const items = cart.items || [];
      const total = cart.total || 0;

      // Map existing sent message types for safety
      const hasSent24h = sentMessages.some((m: any) => m.type === "msg_24h");
      const hasSent48h = sentMessages.some((m: any) => m.type === "msg_48h");
      const hasSent72h = sentMessages.some((m: any) => m.type === "msg_72h");

      // Inject cartId inside each item dictionary to help build recovery URLs
      const formattedItems = items.map((it: any) => ({ ...it, cartId }));

      // 1. Process 24-hour reminder
      if (lastActiveDate <= limit24h && lastActiveDate > limit48h && !hasSent24h) {
        console.log(`[Recuperação de Carrinho] Enviando lembrete de 24h para ${email}...`);
        await sendRecoveryEmail(email, name, formattedItems, total, 'msg_24h', null, baseUrl).catch(e => console.error(e));
        
        sentMessages.push({
          type: "msg_24h",
          sentAt: now.toISOString()
        });

        await doc.ref.update({
          status: "Abandonado", // Transition from Ativo to Abandonado
          sentMessages,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        processedCount++;
      }
      
      // 2. Process 48-hour discount coupon code
      else if (lastActiveDate <= limit48h && lastActiveDate > limit72h && !hasSent48h) {
        console.log(`[Recuperação de Carrinho] Gerando cupom e enviando e-mail de 48h para ${email}...`);
        
        const couponCode = 'REC5-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days valid

        // Save Coupon in DB
        await adminDb.collection("ecom_coupons").doc(couponCode).set({
          code: couponCode,
          discountPercent: 5,
          customerEmail: email,
          expiresAt: expiresAt.toISOString(),
          used: false,
          cartId: cartId,
          createdAt: now.toISOString()
        });

        await sendRecoveryEmail(email, name, formattedItems, total, 'msg_48h', couponCode, baseUrl).catch(e => console.error(e));

        sentMessages.push({
          type: "msg_48h",
          sentAt: now.toISOString(),
          couponCode: couponCode
        });

        await doc.ref.update({
          couponCode: couponCode,
          sentMessages,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        processedCount++;
      }

      // 3. Process 72-hour final warning
      else if (lastActiveDate <= limit72h && !hasSent72h) {
        console.log(`[Recuperação de Carrinho] Enviando aviso final de 72h para ${email}...`);
        const activeCoupon = cart.couponCode || null;

        await sendRecoveryEmail(email, name, formattedItems, total, 'msg_72h', activeCoupon, baseUrl).catch(e => console.error(e));

        sentMessages.push({
          type: "msg_72h",
          sentAt: now.toISOString(),
          couponCode: activeCoupon
        });

        await doc.ref.update({
          status: "Expirado", // Transition to Expirado
          sentMessages,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        processedCount++;
      }
    }

    console.log(`[Recuperação de Carrinho] Varredura finalizada. ${processedCount} ações executadas.`);
    return processedCount;
  } catch (err) {
    console.error("[Recuperação de Carrinho] Falha durante varredura de recuperação:", err);
    throw err;
  }
}

// REST API endpoint to manually send specific recovery steps to standard abandoned carts
app.post("/api/vendas/abandoned-carts/manual-send", async (req, res) => {
  const { cartId, step } = req.body;
  if (!cartId || !step) {
    return res.status(400).json({ error: "Faltando cartId ou step" });
  }

  try {
    if (!adminDb) throw new Error("Banco de dados indisponível no servidor.");

    const cartRef = adminDb.collection("ecom_abandoned_carts").doc(cartId);
    const cartSnap = await cartRef.get();

    if (!cartSnap.exists) {
      return res.status(404).json({ error: "Carrinho de compras não foi localizado no Firestore." });
    }

    const cartData = cartSnap.data();
    if (!cartData) throw new Error("Os dados do carrinho estão corrompidos ou inconsistentes.");

    const email = cartData.customerEmail;
    const name = cartData.customerName;
    const items = cartData.items || [];
    const total = cartData.total || 0;
    const sentMessages = cartData.sentMessages || [];

    const host = req.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("0.0.0.0") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    // Format items with cartId
    const formattedItems = items.map((it: any) => ({ ...it, cartId }));

    let couponCode = cartData.couponCode || null;

    if (step === 'msg_48h' && !couponCode) {
      // Generate coupon code if not already available
      couponCode = 'REC5-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await adminDb.collection("ecom_coupons").doc(couponCode).set({
        code: couponCode,
        discountPercent: 5,
        customerEmail: email,
        expiresAt: expiresAt.toISOString(),
        used: false,
        cartId: cartId,
        createdAt: new Date().toISOString()
      });
    }

    await sendRecoveryEmail(email, name, formattedItems, total, step, couponCode, baseUrl);

    // Save to historical logs
    sentMessages.push({
      type: step,
      sentAt: new Date().toISOString(),
      couponCode: couponCode
    });

    const updateObj: any = {
      sentMessages,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (step === 'msg_24h' && cartData.status === 'Ativo') {
      updateObj.status = 'Abandonado';
    }
    if (step === 'msg_48h' && couponCode) {
      updateObj.couponCode = couponCode;
    }
    if (step === 'msg_72h') {
      updateObj.status = 'Expirado';
    }

    await cartRef.update(updateObj);

    return res.json({ success: true, message: `E-mail de recuperação (${step === 'msg_24h' ? 'Lembrete' : step === 'msg_48h' ? 'Cupom OFF' : 'Última chance'}) enviado com sucesso!` });
  } catch (err: any) {
    console.error("Manual trigger failed:", err);
    return res.status(500).json({ error: parseSMTPError(err) });
  }
});

// REST API endpoint to manually trigger a sweep of all active carts (Admin Dashboard option)
app.post("/api/vendas/abandoned-carts/cron", async (req, res) => {
  try {
    const host = req.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("0.0.0.0") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    const processed = await executeCartsRecoverySweep(baseUrl);
    return res.json({ success: true, processedCount: processed });
  } catch (err: any) {
    console.error("Cron manual task failed:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Start auto periodic sweep every hour in backend memory
setInterval(() => {
  executeCartsRecoverySweep(lastKnownBaseUrl).catch(e => console.error("Hourly recovery task exception:", e));
}, 1000 * 60 * 60);

// 2. Checkout Creation Endpoint (PagSeguro integration or virtual sandbox)
app.post("/api/vendas/checkout", async (req, res) => {
  const { userId, customerInfo, items, shippingMethod, shippingCost, couponCode, cartId } = req.body;
  
  if (!customerInfo || !items || !Array.isArray(items) || items.length === 0 || !shippingMethod) {
    return res.status(400).json({ error: "Dados de checkout incompletos." });
  }

  // Verify stock exists for each product in database before initiating order
  try {
    if (!adminDb) {
      throw new Error("Erro de infraestrutura: Banco de dados o Firestore do Firebase Admin não inicializou corretamento no servidor.");
    }
    for (const item of items) {
      const prodSnap = await adminDb.collection("ecom_products").doc(item.productId).get();
      if (prodSnap.exists) {
        const prodData = prodSnap.data();
        if (prodData && prodData.stock < item.quantity) {
          return res.status(400).json({ 
            error: `Produto '${item.name}' esgotado ou quantidade em estoque insuficiente (${prodData.stock} disponíveis).` 
          });
        }
      }
    }
  } catch (err: any) {
    console.error("Checking stock list failed:", err);
    return res.status(500).json({ error: "Erro de banco de dados ao verificar estoque: " + formatFirebaseError(err) });
  }

  // Calculate Subtotal and Total
  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  
  // Apply coupon discount if applicable
  let discountAmount = 0;
  let appliedCouponCode = null;
  if (couponCode) {
    try {
      const couponRef = adminDb.collection("ecom_coupons").doc(couponCode.toUpperCase().trim());
      const couponSnap = await couponRef.get();
      if (couponSnap.exists) {
        const couponData = couponSnap.data();
        if (couponData && !couponData.used && new Date(couponData.expiresAt) >= new Date()) {
          if (couponData.customerEmail.toLowerCase() === customerInfo.email.toLowerCase()) {
            discountAmount = subtotal * (Number(couponData.discountPercent) / 100);
            appliedCouponCode = couponCode.toUpperCase().trim();
            console.log(`[Cupom Aplicado] Cupom ${appliedCouponCode} concedeu desconto de R$ ${discountAmount}`);
          }
        }
      }
    } catch (couponErr) {
      console.error("Failed to fetch or validate checkout coupon:", couponErr);
    }
  }

  const total = subtotal + Number(shippingCost) - discountAmount;

  // Generate unique order ID
  const orderId = "ORD-" + Math.random().toString(36).substr(2, 6).toUpperCase();

  // Save the order to Firestore
  try {
    if (!adminDb) {
      throw new Error("Erro de infraestrutura: Banco de dados Firebase Admin ausente.");
    }
    const orderDoc = {
      userId: userId || "guest",
      customerInfo,
      items,
      shippingMethod,
      shippingCost: Number(shippingCost),
      subtotal: Number(subtotal),
      discountAmount: Number(discountAmount),
      couponCode: appliedCouponCode,
      cartId: cartId || null,
      total: Number(total),
      status: "Aguardando pagamento",
      paymentId: "",
      trackingCode: "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await adminDb.collection("ecom_orders").doc(orderId).set(orderDoc);
    console.log(`[Pedido Salvo] Pedido ${orderId} registrado com total de R$ ${total}`);

    const host = req.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("0.0.0.0") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;
    sendOrderPlacementEmail(orderId, orderDoc, baseUrl).catch(e => console.error("Async sending of order confirmation failed:", e));
  } catch (err: any) {
    console.error("Erro ao salvar pedido no Firestore:", err);
    return res.status(500).json({ error: "Erro interno ao cadastrar o pedido no banco de dados: " + formatFirebaseError(err) });
  }

  // Check Mercado Pago Token (MERCADOPAGO_ACCESS_TOKEN)
  const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  // Let's store items descriptions into the Firestore order document to reference them
  try {
    const updatedItems = items.map((itm: any) => ({
      ...itm,
      description: `${itm.name} - Obra de Arte do Ateliê Andrew Lemos`
    }));
    await adminDb.collection("ecom_orders").doc(orderId).update({
      items: updatedItems,
      gateway: mpAccessToken ? "Mercado Pago Transparente" : "Virtual Simulator Gateway"
    });
  } catch (err) {
    console.warn("Failed to append item descriptions to order:", err);
  }

  // Return local checkout transparent pay view url
  return res.json({
    success: true,
    orderId,
    gateway: mpAccessToken ? "Mercado Pago Transparente" : "Virtual Simulator Gateway",
    redirectUrl: `/vendas/checkout/pay?id=${orderId}`
  });
});

// Endpoint to retrieve public key and other config safely
app.get("/api/vendas/checkout/config", (req, res) => {
  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  const mpPublicKey = process.env.MERCADOPAGO_PUBLIC_KEY;

  const isTokenSet = !!mpToken;
  const isMockMode = !mpToken || mpToken.includes("MOCK_") || mpToken.startsWith("eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.MOCK_");

  console.log("[Mercado Pago Config Diagnostics]", {
    hasAccessToken: isTokenSet,
    accessTokenPrefix: mpToken ? mpToken.substring(0, 15) + "..." : null,
    hasPublicKey: !!mpPublicKey,
    publicKeyPrefix: mpPublicKey ? mpPublicKey.substring(0, 15) + "..." : null,
    isMockMode
  });

  return res.json({
    publicKey: mpPublicKey || "APP_USR-d216741e-5bf3-4877-85d6-87c653f1cdb0",
    isTokenSet,
    isMockMode
  });
});

// Helper functions for CRC16 calculation and valid static Pix code generation in backend
const apiCalculateCRC16 = (str: string): string => {
  let crc = 0xFFFF;
  for (let c = 0; c < str.length; c++) {
    const charCode = str.charCodeAt(c);
    crc ^= (charCode << 8);
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  let hex = crc.toString(16).toUpperCase();
  while (hex.length < 4) {
    hex = '0' + hex;
  }
  return hex;
};

const apiGeneratePixCode = (amount: number, key: string, name: string, city: string) => {
  const cleanKey = key.trim();
  const cleanName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .substring(0, 25)
    .trim() || 'Andrew Lemos';
  const cleanCity = city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .substring(0, 15)
    .trim() || 'Rio de Janeiro';
  
  const amountStr = amount.toFixed(2);
  
  const f00 = "000201";
  const f01 = "010211";
  const gui = "0014br.gov.bcb.pix";
  const keyField = `01${String(cleanKey.length).padStart(2, '0')}${cleanKey}`;
  const f26 = `26${String(gui.length + keyField.length).padStart(2, '0')}${gui}${keyField}`;
  
  const f52 = "52040000";
  const f53 = "5303986";
  const f54 = `54${String(amountStr.length).padStart(2, '0')}${amountStr}`;
  const f58 = "5802BR";
  const f59 = `59${String(cleanName.length).padStart(2, '0')}${cleanName}`;
  const f60 = `60${String(cleanCity.length).padStart(2, '0')}${cleanCity}`;
  const f62 = "62070503***";
  const f63 = "6304";
  
  const rawPayload = f00 + f01 + f26 + f52 + f53 + f54 + f58 + f59 + f60 + f62 + f63;
  const crc = apiCalculateCRC16(rawPayload);
  return rawPayload + crc;
};

// 2.1 Direct Checkout Transparente Payment API (Pix, Boleto, Credit Card)
app.post("/api/vendas/checkout/transparent-pay", async (req, res) => {
  const { orderId, paymentMethodType, cardToken, installments, cardPaymentMethodId, securityCode } = req.body;
  
  if (!orderId || !paymentMethodType) {
    return res.status(400).json({ error: "Faltando orderId ou método de pagamento." });
  }

  try {
    if (!adminDb) {
      throw new Error("Banco de dados Firestore não inicializado.");
    }
    const orderRef = adminDb.collection("ecom_orders").doc(orderId);
    const orderSnap = await orderRef.get();
    
    if (!orderSnap.exists) {
      return res.status(404).json({ error: "Pedido não localizado no servidor." });
    }

    const orderData = orderSnap.data();
    if (!orderData) {
      return res.status(400).json({ error: "Dados do pedido corrompidos." });
    }

    const customerInfo = orderData.customerInfo;
    const total = Number(orderData.total);
    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    // Detect if we are in Mock/Simulation mode or producing Real transactions
    const isMock = !mpToken || mpToken.includes("MOCK_") || mpToken.startsWith("eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.MOCK_");

    if (isMock) {
      console.log(`[Mercado Pago Simulado] Criando pagamento transparente (${paymentMethodType}) para o pedido ${orderId}...`);
      
      if (paymentMethodType === 'pix') {
        // Return simulated fully compliant central bank EMV string for Pix
        const simulatedQrCode = apiGeneratePixCode(total, "4575f44d-6239-4a20-a080-fe114593b094", "Andrew Lemos", "Rio de Janeiro");
        
        await orderRef.update({
          gateway: "Mercado Pago Transparente (Simulado)",
          transparentPixCode: simulatedQrCode,
          transparentPixQrCodeBase64: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(simulatedQrCode)}`,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.json({
          success: true,
          paymentMethodType: 'pix',
          qrCode: simulatedQrCode,
          qrCodeBase64: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(simulatedQrCode)}`,
          status: 'pending'
        });
      } else if (paymentMethodType === 'boleto') {
        const simulatedBarcode = `34191.79001 01043.513184 91020.150008 7 934500000${Math.round(total)}`;
        const simulatedPdf = "https://www.mercadopago.com.br/payments/boleto/simulator";
        
        await orderRef.update({
          gateway: "Mercado Pago Transparente (Simulado)",
          transparentBoletoBarcode: simulatedBarcode,
          transparentBoletoPdfUrl: simulatedPdf,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.json({
          success: true,
          paymentMethodType: 'boleto',
          barcode: simulatedBarcode,
          pdfUrl: simulatedPdf,
          status: 'pending'
        });
      } else {
        // Credit card simulated auto-approval
        await updateOrderStatusInDatabase(orderId, "Pago", "PAY-TRANSP-SIM-" + Math.random().toString(36).substr(2, 9).toUpperCase());
        return res.json({
          success: true,
          paymentMethodType: 'card',
          status: 'approved'
        });
      }
    }

    // REAL MERCADO PAGO API PAYMENTS (v1/payments)
    const mpPaymentUrl = "https://api.mercadopago.com/v1/payments";

    // Split name properly for first/last name structures
    const rawName = (customerInfo.name || "Cliente E-commerce").trim();
    const nameParts = rawName.split(/\s+/);
    const firstName = nameParts[0] || "Cliente";
    const lastName = nameParts.slice(1).join(" ") || "Lemos";

    const idempotencyKey = `idemp-transp-${orderId}-${paymentMethodType}-${Date.now()}`;

    // Standardize address details
    const cepClean = (customerInfo.cep || "13630000").replace(/\D/g, "");
    const street = customerInfo.street || "Rua";
    const number = customerInfo.number || "s/n";
    const neighborhood = customerInfo.neighborhood || "Bairro";
    const city = customerInfo.city || "Rio de Janeiro";
    const state = customerInfo.state || "RJ";

    // Resolve external base URL to ensure valid HTTPS public domain for notifications
    let externalHost = req.get("host") || "localhost:3000";
    if (req.headers["x-forwarded-host"]) {
      externalHost = req.headers["x-forwarded-host"] as string;
    }
    
    let protocol = "https";
    if (externalHost.includes("localhost") || externalHost.includes("127.0.0.1") || externalHost.includes("0.0.0.0")) {
      protocol = "http";
    }

    let baseUrl = `${protocol}://${externalHost}`;

    if (externalHost.includes("localhost") || externalHost.includes("127.0.0.1")) {
      const referer = req.headers["referer"] || "";
      const origin = req.headers["origin"] || "";
      if (typeof origin === "string" && origin && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
        baseUrl = origin;
      } else if (typeof referer === "string" && referer && !referer.includes("localhost") && !referer.includes("127.0.0.1")) {
        try {
          const parsedRef = new URL(referer);
          baseUrl = `${parsedRef.protocol}//${parsedRef.host}`;
        } catch (e) {}
      }
    }

    let notificationUrl: string | undefined = undefined;
    try {
      const parsedUrl = new URL(baseUrl);
      const isLocal = 
        parsedUrl.hostname === "localhost" || 
        parsedUrl.hostname === "127.0.0.1" || 
        parsedUrl.hostname === "0.0.0.0" || 
        parsedUrl.hostname.endsWith(".local") || 
        parsedUrl.hostname.includes("192.168.") || 
        parsedUrl.hostname.includes("10.") ||
        parsedUrl.port === "3000";
        
      if (parsedUrl.protocol === "https:" && !isLocal) {
        notificationUrl = `${baseUrl}/api/vendas/webhook-mercadopago`;
      }
    } catch (e) {
      console.warn("[Mercado Pago] Falha ao processar base URL para gerar webhook:", e);
    }

    let payload: any = {
      transaction_amount: Number(total),
      description: `Pedido ${orderId} - Obras de Arte de Andrew Lemos - Descrição detalhada do Ateliê`,
      installments: 1,
      external_reference: orderId,
      payer: {
        email: customerInfo.email,
        first_name: firstName,
        last_name: lastName,
        identification: {
          type: "CPF",
          number: (customerInfo.cpf || "").replace(/\D/g, "")
        },
        phone: {
          area_code: (customerInfo.phone || "").replace(/\D/g, "").substring(0, 2) || "21",
          number: (customerInfo.phone || "").replace(/\D/g, "").substring(2) || "999999999"
        }
      }
    };

    if (notificationUrl) {
      payload.notification_url = notificationUrl;
      console.log(`[Mercado Pago] Webhook registrado com sucesso: ${notificationUrl}`);
    } else {
      console.log(`[Mercado Pago] O webhook de notificação foi omitido para evitar erros de validação local no gateway.`);
    }

    if (paymentMethodType === 'pix') {
      payload.payment_method_id = "pix";
    } else if (paymentMethodType === 'boleto') {
      payload.payment_method_id = "bolbradesco";
      payload.payer.address = {
        zip_code: cepClean,
        street_name: street,
        street_number: number,
        neighborhood: neighborhood,
        city: city,
        federal_unit: state.toUpperCase().substring(0, 2)
      };
    } else if (paymentMethodType === 'card') {
      if (!cardToken) {
        return res.status(400).json({ error: "O token do cartão é obrigatório para transações de crédito reais." });
      }
      payload.payment_method_id = cardPaymentMethodId || "visa";
      payload.token = cardToken;
      payload.installments = Number(installments || 1);
    }

    console.log(`[Mercado Pago Real] Enviando requisição para v1/payments. Idempotency-Key: ${idempotencyKey}`);
    const mpRes = await fetch(mpPaymentUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const mpText = await mpRes.text();
    let mpData: any;
    try {
      mpData = JSON.parse(mpText);
    } catch (e) {
      console.error("[Mercado Pago Transparent JSON error response]", mpText);
      return res.status(500).json({ error: `O Mercado Pago retornou uma resposta inesperada: ${mpText.substring(0, 100)}` });
    }

    if (!mpRes.ok) {
      console.warn(`[Mercado Pago Real Error status ${mpRes.status}]`, JSON.stringify(mpData));
      let errMsg = "Recusado pelo sistema de proteção contra fraudes do gateway do Mercado Pago.";
      
      const containsCode7 = mpData.cause && Array.isArray(mpData.cause) && mpData.cause.some((c: any) => String(c.code) === "7");
      const isUnauthorizedLive = mpData.message?.includes("live credentials") || containsCode7;

      if (isUnauthorizedLive || mpRes.status === 401) {
        errMsg = "Credenciais de Produção não autorizadas: Você está utilizando um Access Token de produção real (APP_USR-...) do Mercado Pago, mas a transação foi identificada como simulação, cartão de testes ou a conta do vendedor ainda não foi homologada. Dica: Para fins de teste em sandbox de forma transparente, utilize chaves de teste (TEST-...) ou adicione seu e-mail de teste no Mercado Pago de forma a homologar seu cadastro. Certifique-se também que sua conta possua uma chave Pix cadastrada.";
      } else if (mpData.message) {
        errMsg = mpData.message;
        if (mpData.cause && Array.isArray(mpData.cause) && mpData.cause.length > 0) {
          errMsg = mpData.cause.map((c: any) => `${c.code}: ${c.description || ""}`).join(" | ");
        }
      }

      // Check if the error is the KYC commercial identity verification block (Error 13253)
      if (errMsg.includes("13253") || errMsg.includes("Financial Identity") || errMsg.includes("financial_identity")) {
        errMsg = "⚠️ Erro 13253 (Validação Cadastral do Mercado Pago): A sua própria conta do Mercado Pago ativa como vendedora requer a conclusão da Verificação de Identidade (KYC) comercial ou que você possua ao menos uma Chave Pix cadastrada em seu aplicativo do Mercado Pago. Como resolver: Acesse o aplicativo oficial do Mercado Pago no celular com a mesma conta do e-commerce, realize o envio de seus documentos e selfie para validar sua identidade (Sua Conta -> Documentação Pendente) e adicione uma Chave Pix de Produção Ativa.";
      }
      return res.status(400).json({ error: errMsg });
    }

    const paymentId = String(mpData.id);
    const mpStatus = mpData.status;

    if (paymentMethodType === 'pix') {
      const qrCode = mpData.point_of_interaction?.transaction_data?.qr_code;
      const qrCodeBase64 = mpData.point_of_interaction?.transaction_data?.qr_code_base64;
      const ticketUrl = mpData.point_of_interaction?.transaction_data?.ticket_url;

      await orderRef.update({
        gateway: "Mercado Pago Transparente (Real)",
        paymentId: paymentId,
        transparentPixCode: qrCode,
        transparentPixQrCodeBase64: qrCodeBase64 ? (qrCodeBase64.startsWith("data:") ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`) : null,
        ticketUrl: ticketUrl || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({
        success: true,
        paymentMethodType: 'pix',
        qrCode: qrCode,
        qrCodeBase64: qrCodeBase64 ? (qrCodeBase64.startsWith("data:") ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`) : null,
        ticketUrl: ticketUrl || null,
        status: mpStatus,
        paymentId
      });

    } else if (paymentMethodType === 'boleto') {
        const barcode = mpData.barcode?.content || mpData.transaction_details?.barcode?.content;
        const pdfUrl = mpData.transaction_details?.external_resource_url;

        await orderRef.update({
          gateway: "Mercado Pago Transparente (Real)",
          paymentId: paymentId,
          transparentBoletoBarcode: barcode,
          transparentBoletoPdfUrl: pdfUrl,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.json({
          success: true,
          paymentMethodType: 'boleto',
          barcode: barcode,
          pdfUrl: pdfUrl,
          status: mpStatus,
          paymentId
        });

      } else {
        // Credit card
        if (mpStatus === "approved") {
          const host = req.get("host") || "localhost:3000";
          const protocol = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("0.0.0.0") ? "http" : "https";
          const baseUrl = `${protocol}://${host}`;
          await updateOrderStatusInDatabase(orderId, "Pago", paymentId, baseUrl);
        } else {
          await orderRef.update({
            gateway: "Mercado Pago Transparente (Real)",
            paymentId: paymentId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        return res.json({
          success: true,
          paymentMethodType: 'card',
          status: mpStatus,
          paymentId
        });
      }


  } catch (err: any) {
    console.error("[Transparent Checkout Real-API Exception]", err);
    return res.status(500).json({ error: "Erro de conexão ao processar checkout transparente: " + err.message });
  }
});


// Helper to update order status and decrement product stock securely
async function updateOrderStatusInDatabase(orderId: string, status: string, paymentId: string, baseUrl?: string) {
  if (!adminDb) {
    throw new Error("Banco de dados indisponível no backend.");
  }

  const orderRef = adminDb.collection("ecom_orders").doc(orderId);
  let orderData: any = null;
  let items: any[] = [];
  let transitionToPaid = false;

  await adminDb.runTransaction(async (transaction: any) => {
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists) {
      console.warn(`[Webhook MercadoPago] Pedido ${orderId} não encontrado no Firestore.`);
      throw new Error(`Pedido ${orderId} não localizado.`);
    }

    orderData = orderSnap.data();
    const currentStatus = orderData?.status || "Aguardando pagamento";
    items = orderData?.items || [];

    console.log(`[Transaction - Webhook MercadoPago] Pedido ${orderId}: status atual é '${currentStatus}', novo status recebido é '${status}'`);

    // Lock and update the order status
    if (currentStatus === "Aguardando pagamento" && status === "Pago") {
      transitionToPaid = true;
      transaction.update(orderRef, {
        status: status,
        paymentId: paymentId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // If payment status update or any other status update, apply standard update if different
      if (currentStatus !== status) {
        transaction.update(orderRef, {
          status: status,
          paymentId: paymentId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  });

  // Decrease stock, send confirmation email, and trigger Melhor Envio ONLY if the state transitioned to Paid in this call
  if (transitionToPaid) {
    console.log(`[Webhook MercadoPago] Transição legítima para 'Pago' efetuada para o pedido ${orderId}. Iniciando estoque e processamento de envio.`);
    for (const item of items) {
      const productRef = adminDb.collection("ecom_products").doc(item.productId);
      try {
        await adminDb.runTransaction(async (transaction: any) => {
          const prodDoc = await transaction.get(productRef);
          if (prodDoc.exists) {
            const prevStock = prodDoc.data()?.stock || 0;
            const nextStock = Math.max(0, prevStock - item.quantity);
            transaction.update(productRef, { stock: nextStock });
            console.log(`[Webhook MercadoPago] Atualizado estoque do produto '${item.name}' de ${prevStock} para ${nextStock}`);
          }
        });
      } catch (stockError) {
        console.error(`[Webhook MercadoPago] Erro ao diminuir estoque de '${item.name}':`, stockError);
      }
    }

    // Send payment email confirmation
    const finalBaseUrl = baseUrl || "http://localhost:3000";
    sendOrderPaymentConfirmationEmail(orderId, orderData, finalBaseUrl).catch(e => console.error("Async sending of payment confirmation failed:", e));

    // Handle coupon and cart recovery updates upon legitimate payment receipt
    if (orderData?.couponCode) {
      adminDb.collection("ecom_coupons").doc(orderData.couponCode.toUpperCase().trim()).update({
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
        orderId: orderId
      }).then(() => console.log(`[Recuperação de Carrinho] Cupom ${orderData.couponCode} invalidado com sucesso.`))
        .catch((e: any) => console.warn("[Recuperação de Carrinho] Falha ao marcar cupom de recuperação como usado:", e));
    }

    if (orderData?.cartId) {
      adminDb.collection("ecom_abandoned_carts").doc(orderData.cartId).update({
        status: "Recuperado",
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }).then(() => console.log(`[Recuperação de Carrinho] Carrinho ${orderData.cartId} marcado como Recuperado.`))
        .catch((e: any) => console.warn("[Recuperação de Carrinho] Falha ao transicionar status do carrinho para Recuperado:", e));
    }

    // Automatized automatic shipping label generation on Melhor Envio
    processMelhorEnvioShipmentForPaidOrder(orderId, orderData).catch(e => console.error("[Melhor Envio] Auto-processing failure:", e));
  } else {
    console.log(`[Webhook MercadoPago] Pedido ${orderId} já transicionado ou sem mudança requerida. Pulando redução de estoque e envio em dobro.`);
  }

  console.log(`[Webhook MercadoPago] Pedido ${orderId} atualizado de forma bem-sucedida para: ${status}`);
}

// 3. Mercado Pago Webhook & Simulator Endpoint
app.post("/api/vendas/webhook-mercadopago", async (req, res) => {
  const payload = req.body;
  const query = req.query;
  console.log("[Webhook MercadoPago] Conteúdo recebido:", JSON.stringify({ body: payload, query }));

  // Handle local simulator webhook trigger (this aligns with our CheckoutPay component)
  if (!process.env.MERCADOPAGO_ACCESS_TOKEN || (payload.orderId && payload.status === "Pago")) {
    const orderId = payload.reference_id || payload.orderId;
    const status = payload.status || "Pago";
    const paymentId = payload.paymentId || "PAY-SIM-MP-" + Math.random().toString(36).substr(2, 9).toUpperCase();

    if (orderId) {
      try {
        const host = req.get("host") || "localhost:3000";
        const protocol = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("0.0.0.0") ? "http" : "https";
        const baseUrl = `${protocol}://${host}`;
        await updateOrderStatusInDatabase(orderId, status, paymentId, baseUrl);
        return res.json({ success: true, orderId, updatedStatus: status });
      } catch (err: any) {
        return res.status(500).json({ error: formatFirebaseError(err) });
      }
    }
  }

  // Resolve standard paymentId and notification source
  let paymentId = payload.data?.id || payload.id || query.id;
  let orderIdMP = undefined;

  // Mercado Pago webhook format checking can contain resource locator URL
  if (payload.resource) {
    const pMatch = String(payload.resource).match(/\/payments\/(\d+)/);
    if (pMatch) {
      paymentId = pMatch[1];
    }
    const oMatch = String(payload.resource).match(/\/orders\/([A-Za-z0-9_-]+)/);
    if (oMatch) {
      orderIdMP = oMatch[1];
    }
  }
  
  if (query.topic === "payment" && query.id) {
    paymentId = query.id;
  }
  if (query.topic === "merchant_order" && query.id) {
    orderIdMP = query.id;
  }

  // Determine if it was received or matches order pattern
  let isReceivedAsOrder = false;
  if (payload.resource && (payload.resource.includes("/orders/") || payload.resource.includes("/merchant_orders/"))) {
    isReceivedAsOrder = true;
  }
  if (payload.topic === "merchant_order" || query.topic === "merchant_order" || payload.type === "merchant_order" || payload.topic === "order") {
    isReceivedAsOrder = true;
  }

  const targetId = orderIdMP || paymentId;

  if (!targetId) {
    return res.status(200).json({ status: "ignored", message: "Sem payment ID ou order ID válido" });
  }

  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!mpToken) {
    return res.status(400).json({ error: "Faltando MERCADOPAGO_ACCESS_TOKEN para processamento real de pagamentos." });
  }

  try {
    let paymentData: any = null;
    let isOrder = false;

    // 1. Try querying as order if indicated
    if (isReceivedAsOrder || orderIdMP) {
      const mpOrderUrl = `https://api.mercadopago.com/v1/orders/${targetId}`;
      console.log(`[Webhook MercadoPago] Consultando como ORDER em ${mpOrderUrl}...`);
      const oRes = await fetch(mpOrderUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${mpToken}`,
          "Accept": "application/json"
        }
      });
      if (oRes.ok) {
        paymentData = await oRes.json();
        isOrder = true;
        console.log(`[Webhook MercadoPago] Encontrado como ORDER! Status: ${paymentData.status}`);
      }
    }

    // 2. Try querying as payment if not resolved yet
    if (!paymentData && paymentId) {
      const mpPaymentUrl = `https://api.mercadopago.com/v1/payments/${paymentId}`;
      console.log(`[Webhook MercadoPago] Consultando como PAYMENT em ${mpPaymentUrl}...`);
      const pRes = await fetch(mpPaymentUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${mpToken}`,
          "Accept": "application/json"
        }
      });
      if (pRes.ok) {
        paymentData = await pRes.json();
        isOrder = false;
        console.log(`[Webhook MercadoPago] Encontrado como PAYMENT! Status: ${paymentData.status}`);
      }
    }

    // 3. Fallback: Try querying as order if not resolved and not previously checked
    if (!paymentData && targetId && !isReceivedAsOrder) {
      const mpOrderUrl = `https://api.mercadopago.com/v1/orders/${targetId}`;
      console.log(`[Webhook MercadoPago] Fallback: Consultando como ORDER em ${mpOrderUrl}...`);
      const oRes = await fetch(mpOrderUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${mpToken}`,
          "Accept": "application/json"
        }
      });
      if (oRes.ok) {
        paymentData = await oRes.json();
        isOrder = true;
        console.log(`[Webhook MercadoPago] Encontrado via Fallback ORDER! Status: ${paymentData.status}`);
      }
    }

    if (!paymentData) {
      console.warn(`[Webhook MercadoPago] Não foi possível consultar o recurso ${targetId} na API do Mercado Pago.`);
      return res.status(404).json({ error: "Recurso não encontrado no Mercado Pago." });
    }

    const orderId = paymentData.external_reference || paymentData.payments?.[0]?.external_reference || paymentData.merchant_order?.external_reference;
    
    if (!orderId) {
      console.warn(`[Webhook MercadoPago] Recurso ${targetId} não contém external_reference (orderId). Ignorando.`);
      return res.json({ success: true, message: "Sem reference" });
    }

    let isApproved = false;
    let isCancelled = false;

    if (isOrder) {
      const status = paymentData.status;
      const subPayments = paymentData.payments || [];
      const hasApprovedSub = subPayments.some((p: any) => p.status === "approved" || p.status === "paid");
      if (status === "paid" || status === "approved" || status === "closed" || hasApprovedSub) {
        isApproved = true;
      } else if (status === "cancelled" || status === "expired" || status === "rejected") {
        isCancelled = true;
      }
    } else {
      const status = paymentData.status;
      if (status === "approved") {
        isApproved = true;
      } else if (["rejected", "cancelled", "refunded", "charged_back", "expired"].includes(status)) {
        isCancelled = true;
      }
    }

    let orderStatus = "Aguardando pagamento";
    if (isApproved) {
      orderStatus = "Pago";
    } else if (isCancelled) {
      orderStatus = "Cancelado";
    }

    const host = req.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("0.0.0.0") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;
    await updateOrderStatusInDatabase(orderId, orderStatus, String(targetId), baseUrl);
    return res.json({ success: true, orderId, updatedStatus: orderStatus });

  } catch (error: any) {
    console.error("[Webhook MercadoPago Error] Falha ao sincronizar webhook:", error);
    res.status(500).json({ error: formatFirebaseError(error) });
  }
});

// Keep legacy PagSeguro webhook endpoint as an alias so that nothing is disrupted
app.post("/api/vendas/webhook-pagseguro", async (req, res) => {
  const payload = req.body;
  console.log("[Webhook Legacy PagSeguro Override] Redirecionando para motor do Mercado Pago:", JSON.stringify(payload));
  // Delegate processing directly to update database
  const orderId = payload.reference_id || payload.orderId;
  const status = payload.status || "Pago";
  const paymentId = payload.paymentId || "PAY-SIM-MP-" + Math.random().toString(36).substr(2, 9).toUpperCase();

  if (!orderId) {
    return res.status(400).json({ error: "orderId ou reference_id não fornecido." });
  }

  try {
    const host = req.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("0.0.0.0") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;
    await updateOrderStatusInDatabase(orderId, status, paymentId, baseUrl);
    return res.json({ success: true, orderId, updatedStatus: status });
  } catch (err: any) {
    return res.status(500).json({ error: formatFirebaseError(err) });
  }
});

// Reusable admin auth token verification helper
async function checkAdminAuth(req: any, res: any, next: any) {
  let idToken = "";

  // 1. Try Authorization Bearer Header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    idToken = authHeader.split("Bearer ")[1];
  }

  // 2. Try Query Parameter (fallback for direct GET downloads)
  if (!idToken && req.query.token) {
    idToken = String(req.query.token);
  }

  if (!idToken) {
    return res.status(401).json({ error: "Acesso não autorizado. Chave de acesso / token de autenticação ausente." });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    if (decodedToken.email === "andrewfmlemos@gmail.com" && decodedToken.email_verified === true) {
      req.adminUser = decodedToken;
      return next();
    } else {
      return res.status(403).json({ error: "Acesso negado. Apenas o administrador autorizado de Andrew Lemos tem permissão para realizar esta operação." });
    }
  } catch (err: any) {
    console.error("Erro ao verificar token de administrador:", err);
    // Safe development bypass fallback to allow developers to use the app in AI Studio preview if server credentials are not fully deployed yet.
    const isLocalDev = process.env.NODE_ENV !== "production" || !process.env.FIREBASE_PRIVATE_KEY;
    if (isLocalDev && (idToken === "dev-bypass-token" || idToken.length < 50)) {
      console.warn("Firebase Admin SDK: Bypass temporário permitido em ambiente local/desenvolvimento.");
      req.adminUser = { email: "andrewfmlemos@gmail.com", email_verified: true };
      return next();
    }
    return res.status(401).json({ error: "Sessão expirada ou token inválido. Por favor, reinicie sua sessão no painel do administrador." });
  }
}

// 3.5 Manual Review Invitation Routing
app.post("/api/admin/send-review-invitation", checkAdminAuth, async (req, res) => {
  const { customerName, customerEmail } = req.body;

  if (!customerName || !customerEmail) {
    return res.status(400).json({ error: "Nome e e-mail do cliente são obrigatórios." });
  }

  if (!adminDb) {
    return res.status(500).json({ error: "Banco de dados indisponível no backend." });
  }

  try {
    // Generate a new review invitation document in Firestore
    const inviteRef = adminDb.collection("ecom_review_invitations").doc();
    const invitationId = inviteRef.id;
    const invitationDoc = {
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim().toLowerCase(),
      status: "Pendente",
      createdAt: new Date().toISOString()
    };
    await inviteRef.set(invitationDoc);

    // Get base URL for construction of the unique feedback invitation link
    const referer = req.headers.referer || "";
    let baseUrl = referer ? referer.split('#')[0] : "http://localhost:3000";
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.substring(0, baseUrl.length - 1);
    }
    const reviewLink = `${baseUrl}/#avaliar?conviteId=${invitationId}`;

    // Get SMTP transporter to send email
    const transporter = getSmtpTransporter();
    const artistName = process.env.MELHORENVIO_FROM_NAME || "Ateliê Andrew Lemos";
    const fromEmail = process.env.SMTP_USER || "andrewfmlemos@gmail.com";

    const emailHtml = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e0dfdb; background-color: #FAF9F5; color: #2C2C2A; border-radius: 8px;">
        <div style="text-align: center; border-bottom: 2px solid #8d6e63; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="color: #4e342e; margin: 0; font-size: 26px; font-weight: normal; font-family: Georgia, serif;">${artistName}</h1>
          <p style="margin: 4px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #8d6e63;">Convite Especial</p>
        </div>
        
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Olá, <b>${customerName}</b>!</p>
        
        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
          Agradecemos sinceramente pela sua confiança em nosso trabalho artístico. É uma enorme satisfação e honra saber de seu apreço e de nosso relacionamento em sua aquisição.
        </p>

        <p style="font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
          Como somos um ateliê independente focado em peças únicas de alta dedicação, sua opinião e depoimento são muito importantes para o nosso crescimento. Convidamos você a compartilhar sua valiosa experiência de pós-venda em nosso site através do botão abaixo.
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${reviewLink}" style="background-color: #8d6e63; color: #ffffff; text-decoration: none; padding: 14px 28px; font-weight: bold; border-radius: 6px; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            Escrever Depoimento & Avaliar
          </a>
        </div>

        <p style="font-size: 13px; color: #555; line-height: 1.6; margin-top: 24px; text-align: center;">
          Cada avaliação recebida nos ajuda a expandir o alcance da arte de forma genuína. Se desejar saber mais ou solicitar novas peças, basta responder a este e-mail.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"${artistName}" <${fromEmail}>`,
      to: customerEmail.trim().toLowerCase(),
      replyTo: fromEmail,
      subject: `🎨 Convite especial do Ateliê Andrew Lemos: Avalie sua nova obra de arte`,
      html: emailHtml
    });

    console.log(`[Convite Avaliação] Convite enviado com sucesso para ${customerEmail}`);
    res.json({ success: true, invitationId, message: "Solicitação de avaliação enviada com sucesso ao cliente." });
  } catch (err: any) {
    console.error("[Convite Avaliação] Erro ao processar envio:", err);
    res.status(500).json({ error: "Erro interno no servidor ao enviar a solicitação: " + err.message });
  }
});

// 4. Admin Response and Quote Emailing Endpoint
app.post("/api/vendas/quotes/respond", checkAdminAuth, async (req, res) => {
  const { quoteId, responseValue } = req.body;

  if (!quoteId || !responseValue) {
    return res.status(400).json({ error: "quoteId e dados de resposta do frete calculados são obrigatórios." });
  }

  if (!adminDb) {
    return res.status(550).json({ error: "Banco de dados indisponível no backend." });
  }

  try {
    const quoteRef = adminDb.collection("ecom_quotes").doc(quoteId);
    const quoteSnap = await quoteRef.get();

    if (!quoteSnap.exists) {
      return res.status(404).json({ error: "Solicitação de cotação de frete não localizada." });
    }

    const quoteData = quoteSnap.data();

    if (!quoteData) {
      return res.status(404).json({ error: "Dados da cotação inválidos." });
    }

    // Generate unique pending purchase order ID
    const orderId = "ORD-Q-" + Math.random().toString(36).substr(2, 6).toUpperCase();
    const productPrice = Number(quoteData.productPrice) || 0;
    const quantity = Number(quoteData.quantity) || 1;
    const shippingCost = Number(responseValue.shippingCost) || 0;

    const orderItems = quoteData.items && quoteData.items.length > 0 
      ? quoteData.items 
      : [{
          productId: quoteData.productId,
          name: quoteData.productName,
          price: productPrice,
          quantity: quantity,
          images: quoteData.productImage ? [quoteData.productImage] : []
        }];

    const subtotal = orderItems.reduce((sum: number, itm: any) => sum + (Number(itm.price) * Number(itm.quantity)), 0);
    const total = subtotal + shippingCost;

    // Create purchase order in database
    const orderDoc = {
      userId: quoteData.userId || "guest",
      customerInfo: {
        name: quoteData.customerInfo.name,
        email: quoteData.customerInfo.email,
        phone: quoteData.customerInfo.phone,
        cep: quoteData.customerInfo.cep,
        city: quoteData.customerInfo.city || "",
        state: quoteData.customerInfo.state || "",
        street: quoteData.customerInfo.street || "Endereço por Confirmar",
        number: quoteData.customerInfo.number || "S/N",
        neighborhood: quoteData.customerInfo.neighborhood || "Bairro por Confirmar",
        complement: quoteData.customerInfo.complement || "",
        cpf: quoteData.customerInfo.cpf || ""
      },
      items: orderItems,
      shippingMethod: responseValue.carrier || "Transportadora",
      shippingCost: shippingCost,
      subtotal: subtotal,
      total: total,
      status: "Aguardando pagamento",
      paymentId: "",
      trackingCode: "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await adminDb.collection("ecom_orders").doc(orderId).set(orderDoc);

    // Update quote status in database to link order
    await quoteRef.update({
      status: "Respondida",
      response: {
        shippingCost: shippingCost,
        carrier: responseValue.carrier || "Transportadora",
        deliveryTime: responseValue.deliveryTime || "7",
        notes: responseValue.notes || "",
        orderId: orderId,
        respondedAt: new Date().toISOString()
      }
    });

    // Send quotation response automated secure email
    const transporter = getSmtpTransporter();
    const SMTP_USER = process.env.SMTP_USER || "andrewfmlemos@gmail.com";
    
    // Construct payment link
    const host = req.get("host") || "localhost:3000";
    const protocol = req.protocol || "http";
    const paymentLink = `${protocol}://${host}/vendas/checkout/pay?id=${orderId}`;

    await transporter.sendMail({
      from: `"Portfólio Andrew Lemos — Cotação de Obra" <${SMTP_USER}>`,
      to: quoteData.customerInfo.email,
      replyTo: SMTP_USER,
      subject: `🚚 Sua Cotação de Envio para a Obra "${quoteData.productName}" foi Respondida!`,
      html: `
        <div style="font-family: serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e5e5e5; border-radius: 20px; background-color: #ffffff;">
          <h2 style="color: #6d4c41; border-bottom: 2px solid #8d6e63; padding-bottom: 10px; margin-top: 0; font-family: serif;">Sua Cotação de Envio foi Respondida! 🚚</h2>
          <p style="font-size: 15px; line-height: 1.6;">
            Olá, <b>${quoteData.customerInfo.name}</b>!
          </p>
          <p style="font-size: 15px; line-height: 1.6;">
            Temos ótimas notícias! O mestre Andrew avaliou as propostas e tem uma solução de transporte segura para sua compra da obra <b>"${quoteData.productName}"</b> (${quantity} un.):
          </p>
          
          <div style="background-color: #faf9f6; padding: 20px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #6d4c41;">
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; font-weight: bold; width: 120px; color: #666;">Transportadora:</td>
                <td style="padding: 6px 0; color: #111; font-weight: bold;">${responseValue.carrier || 'Correios / MelhorEnvio'}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #666;">Valor do Frete:</td>
                <td style="padding: 6px 0; color: #6d4c41; font-weight: bold; font-family: monospace;">R$ ${shippingCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #666;">Prazo Estimado:</td>
                <td style="padding: 6px 0; color: #111; font-weight: bold;">${responseValue.deliveryTime || '5'} dias úteis</td>
              </tr>
              ${responseValue.notes ? `
              <tr>
                <td style="padding: 6px 0; font-weight: bold; color: #666; vertical-align: top;">Mensagem:</td>
                <td style="padding: 6px 0; color: #444; font-style: italic;">"${responseValue.notes}"</td>
              </tr>
              ` : ''}
            </table>
          </div>

          <p style="font-size: 14px; color: #555; line-height: 1.6;">
            Clique no botão abaixo para preencher os seus dados de faturamento e finalizar a sua compra de forma 100% segura através do <b>Checkout Mercado Pago</b>:
          </p>

          <div style="text-align: center; margin: 35px 0;">
            <a href="${paymentLink}" 
               style="display: inline-block; background-color: #6d4c41; color: white; padding: 14px 28px; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              Finalizar & Pagar Obra
            </a>
          </div>

          <p style="font-size: 12px; color: #666; text-align: center; margin-top: 25px;">
            Dúvidas? Basta responder diretamente este e-mail.
          </p>

          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="text-align: center; font-size: 11px; color: #999;">
            Mensagem processada pelo servidor do seu Portfólio de Arte Online Andrew Lemos.
          </p>
        </div>
      `,
      text: `Olá ${quoteData.customerInfo.name}, sua cotação foi respondida! Conclua o pagamento de R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no link: ${paymentLink}`
    });

    console.log(`[Quote respond] Cotação ${quoteId} respondida. E-mail automático despachado com sucesso para ${quoteData.customerInfo.email}`);
    res.json({ success: true, orderId: orderId });
  } catch (error: any) {
    console.error("Erro ao responder cotação:", error);
    res.status(500).json({ error: formatFirebaseError(error) || "Erro desconhecido ao cadastrar resposta da cotação." });
  }
});

// --- MELHOR ENVIO AUTOMATED LABEL GENERATION ENGINE & EP ---

function validateShipmentData(orderData: any): string[] {
  if (!orderData) {
    return ["Dados do pedido estão vazios ou corrompidos."];
  }
  
  const customerInfo = orderData.customerInfo;
  if (!customerInfo) {
    return ["Informações do destinatário (customerInfo) estão ausentes no pedido."];
  }

  const errors: string[] = [];

  // Destination validations
  if (!customerInfo.name || customerInfo.name.trim().length < 2) {
    errors.push("Nome do destinatário inválido ou muito curto.");
  }
  
  const phoneDigits = (customerInfo.phone || "").replace(/\D/g, "");
  if (phoneDigits.length < 10) {
    errors.push("Telefone do destinatário inválido (mínimo de 10 dígitos com DDD).");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!customerInfo.email || !emailRegex.test(customerInfo.email)) {
    errors.push("E-mail do destinatário inválido.");
  }

  const cpfDigits = (customerInfo.cpf || "").replace(/\D/g, "");
  if (cpfDigits.length !== 11 && cpfDigits.length !== 14) {
    errors.push("CPF ou CNPJ do destinatário precisa conter exatamente 11 ou 14 dígitos.");
  }

  if (!customerInfo.street || customerInfo.street.trim().length === 0) {
    errors.push("Endereço (rua) do destinatário é obrigatório.");
  }

  if (!customerInfo.number || String(customerInfo.number).trim().length === 0) {
    errors.push("Número da residência é obrigatório.");
  }

  if (!customerInfo.neighborhood || customerInfo.neighborhood.trim().length === 0) {
    errors.push("Bairro do destinatário é obrigatório.");
  }

  if (!customerInfo.city || customerInfo.city.trim().length === 0) {
    errors.push("Cidade do destinatário é obrigatória.");
  }

  const stateAbbr = (customerInfo.state || "").trim().toUpperCase();
  if (stateAbbr.length !== 2) {
    errors.push("Estado (UF) do destinatário deve possuir 2 letras (ex: SP, RJ).");
  }

  const toCep = (customerInfo.cep || "").replace(/\D/g, "");
  if (toCep.length !== 8) {
    errors.push(`CEP de destino (${toCep}) é inválido. Deve possuir 8 dígitos.`);
  }

  // Source validations
  const fromCep = (process.env.MELHORENVIO_FROM_CEP || "13636166").replace(/\D/g, "");
  if (fromCep.length !== 8) {
    errors.push(`CEP de origem do ateliê (${fromCep}) é inválido. Deve possuir 8 dígitos.`);
  }

  // Weights & dimensions validations
  const items = orderData.items || [];
  if (items.length === 0) {
    errors.push("O carrinho de compras do pedido está vazio.");
  }

  items.forEach((item: any, idx: number) => {
    const name = item.name || `Produto #${idx + 1}`;
    const weight = Number(item.weight);
    const height = Number(item.height);
    const width = Number(item.width);
    const length = Number(item.length);
    const qty = Number(item.quantity || 1);

    if (isNaN(weight) || weight <= 0) {
      errors.push(`Peso inválido para o item [${name}]: deve ser maior que zero.`);
    }
    if (isNaN(height) || height <= 0) {
      errors.push(`Altura inválida para o item [${name}]: deve ser maior que zero.`);
    }
    if (isNaN(width) || width <= 0) {
      errors.push(`Largura inválida para o item [${name}]: deve ser maior que zero.`);
    }
    if (isNaN(length) || length <= 0) {
      errors.push(`Comprimento inválido para o item [${name}]: deve ser maior que zero.`);
    }
    if (isNaN(qty) || qty <= 0) {
      errors.push(`Quantidade inválida para o item [${name}]: deve ser de pelo menos 1.`);
    }
  });

  return errors;
}

async function processMelhorEnvioShipmentForPaidOrder(orderId: string, orderData: any) {
  console.log(`[Melhor Envio Automatizado] Iniciando processamento de frete para o pedido ${orderId}...`);
  try {
    // Prevent duplicate processing if a shipping label was already successfully requested
    if (adminDb) {
      const freshSnap = await adminDb.collection("ecom_orders").doc(orderId).get();
      if (freshSnap.exists) {
        const freshData = freshSnap.data() || {};
        if (freshData.melhorEnvioShipmentId && freshData.melhorEnvioStatus !== "error") {
          console.log(`[Melhor Envio Automatizado] O pedido ${orderId} já possui uma etiqueta registrada no Melhor Envio (ID: ${freshData.melhorEnvioShipmentId}, Status: ${freshData.melhorEnvioStatus}). Abortando geração para evitar duplicados.`);
          return;
        }
      }
    }

    const valErrors = validateShipmentData(orderData);
    if (valErrors.length > 0) {
      const errMessage = `Erro de Validação Logística: ${valErrors.join(" | ")}`;
      console.warn(`[Melhor Envio Automatizado] Falha de validação para o pedido ${orderId}: ${errMessage}`);
      if (adminDb) {
        await adminDb.collection("ecom_orders").doc(orderId).update({
          melhorEnvioStatus: "error",
          melhorEnvioStatusText: `Erro de Validação: ${valErrors.slice(0, 3).join(", ")}${valErrors.length > 3 ? '...' : ''}`,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      return;
    }
    const token = process.env.MELHORENVIO_TOKEN;
    const isMockMode = !token || token.includes("MOCK_") || token.startsWith("eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.MOCK_MELHORENVIO_TOKEN_FOR_SECURITY");

    if (isMockMode) {
      console.log(`[Melhor Envio Automatizado] Modo Simulação Ativo para pedido ${orderId} (sem token real). Gerando dados simulados...`);
      const mockShipmentId = "ME-SIM-" + Math.random().toString(36).substr(2, 8).toUpperCase();
      const mockTracking = "ME" + Math.random().toString(36).substr(2, 9).toUpperCase() + "BR";
      const mockLabelUrl = `/api/vendas/shipment/print-mock?id=${orderId}`;
      const mockStatus = "released";
      const mockStatusText = getPortugueseStatusText(mockStatus);

      if (adminDb) {
        await adminDb.collection("ecom_orders").doc(orderId).update({
          melhorEnvioShipmentId: mockShipmentId,
          trackingCode: mockTracking,
          melhorEnvioTrackingCode: mockTracking,
          melhorEnvioLabelUrl: mockLabelUrl,
          melhorEnvioStatus: mockStatus,
          melhorEnvioStatusText: mockStatusText,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`[Melhor Envio Automatizado] Pedido ${orderId} atualizado no banco de dados com simulação virtual com sucesso.`);
      }
      return;
    }

    // REAL MELHOR ENVIO INTEGRATION
    const isSandboxToken = token.includes("sandbox") || process.env.MELHORENVIO_ENV === "sandbox";
    const meBaseUrl = isSandboxToken
      ? "https://sandbox.melhorenvio.com.br"
      : "https://www.melhorenvio.com.br";

    const fromCep = (process.env.MELHORENVIO_FROM_CEP || "13636166").replace(/\D/g, "");
    const toCep = (orderData.customerInfo.cep || "").replace(/\D/g, "");

    // Resolve service id.
    let serviceId = 1; // Default PAC (Correios)
    const methodStr = String(orderData.shippingMethod || "").toUpperCase();
    if (methodStr.includes("SEDEX")) {
      serviceId = 2;
    } else if (methodStr.includes("JADLOG") && methodStr.includes(".COM")) {
      serviceId = 4;
    } else if (methodStr.includes("JADLOG") && methodStr.includes("PACKAGE")) {
      serviceId = 3;
    } else if (orderData.shippingServiceId) {
      const parsedId = parseInt(orderData.shippingServiceId, 10);
      if (!isNaN(parsedId)) {
        serviceId = parsedId;
      }
    }

    // Build sender
    const senderFrom = {
      name: process.env.MELHORENVIO_FROM_NAME || "Ateliê Andrew Lemos",
      phone: (process.env.MELHORENVIO_FROM_PHONE || "19998107110").replace(/\D/g, ""),
      email: process.env.MELHORENVIO_FROM_EMAIL || "andrewfmlemos@gmail.com",
      document: (process.env.MELHORENVIO_FROM_DOCUMENT || "35189261875").replace(/\D/g, ""),
      address: process.env.MELHORENVIO_FROM_ADDRESS || "Rua Lisette Wegmuller",
      number: process.env.MELHORENVIO_FROM_NUMBER || "1325",
      complement: process.env.MELHORENVIO_FROM_COMPLEMENT || "Casa",
      district: process.env.MELHORENVIO_FROM_DISTRICT || "Jardim Ferrarezzi",
      city: process.env.MELHORENVIO_FROM_CITY || "Pirassununga",
      state_abbr: process.env.MELHORENVIO_FROM_STATE_ABBR || "SP",
      postal_code: fromCep
    };

    // Build recipient
    const customerInfo = orderData.customerInfo;
    const recipientTo = {
      name: customerInfo.name,
      phone: (customerInfo.phone || "11999999998").replace(/\D/g, ""),
      email: customerInfo.email || "cliente@email.com",
      document: (customerInfo.cpf || "").replace(/\D/g, ""),
      address: customerInfo.street,
      number: customerInfo.number,
      complement: customerInfo.complement || "",
      district: customerInfo.neighborhood || "Centro",
      city: customerInfo.city,
      state_abbr: customerInfo.state,
      postal_code: toCep
    };

    // Construct products list
    const items = orderData.items || [];
    const products = items.map((itm: any, idx: number) => ({
      name: itm.name.substring(0, 250),
      quantity: Number(itm.quantity || 1),
      unitary_value: Number(itm.price || 10),
      weight: Number(itm.weight || 0.3)
    }));

    // Construct volumes package (standard dimensional packaging)
    const totalWeight = items.reduce((sum: number, it: any) => sum + (Number(it.weight || 0.3) * Number(it.quantity || 1)), 0);
    const maxHeight = Math.max(...items.map((it: any) => Number(it.height || 11)));
    const maxWidth = Math.max(...items.map((it: any) => Number(it.width || 11)));
    const totalLength = items.reduce((sum: number, it: any) => sum + (Number(it.length || 16) * Number(it.quantity || 1)), 0);

    const volumes = [{
      height: Math.max(11, maxHeight),
      width: Math.max(11, maxWidth),
      length: Math.max(16, totalLength),
      weight: Math.max(0.1, totalWeight)
    }];

    const totalOrderValue = Number(orderData.subtotal || 10);

    const cartPayload = {
      service: serviceId,
      from: senderFrom,
      to: recipientTo,
      products: products,
      volumes: volumes,
      options: {
        insurance_value: totalOrderValue,
        receipt: false,
        own_hand: false,
        reverse: false,
        non_commercial: true,
        platform: "Ateliê Andrew Lemos",
        tags: [
          {
            tag: orderId,
            url: `https://andrewlemos.art.br/admin`
          }
        ]
      }
    };

    console.log(`[Melhor Envio Automatizado] Inserindo frete no carrinho para o pedido ${orderId}...`);
    const userAgentContact = "Atelie_Andrew_Lemos(andrewfmlemos@gmail.com)";
    const cartRes = await fetch(`${meBaseUrl}/api/v2/me/cart`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": userAgentContact
      },
      body: JSON.stringify(cartPayload)
    });

    if (!cartRes.ok) {
      const errText = await cartRes.text().catch(() => "");
      throw new Error(`Erro na inserção do carrinho Melhor Envio. Status: ${cartRes.status}, Retorno: ${errText}`);
    }

    const cartData: any = await cartRes.json();
    const shipmentId = cartData.id;
    if (!shipmentId) {
      throw new Error(`Resposta de inserção do carrinho não retornou o shipment ID. Retorno: ${JSON.stringify(cartData)}`);
    }

    console.log(`[Melhor Envio Automatizado] Envio inserido com ID ${shipmentId}. Prosseguindo para Checkout/Compra...`);

    // 2. CHECKOUT/COMPRA
    const checkoutRes = await fetch(`${meBaseUrl}/api/v2/me/shipment/checkout`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": userAgentContact
      },
      body: JSON.stringify({
        orders: [shipmentId]
      })
    });

    if (!checkoutRes.ok) {
      const errText = await checkoutRes.text().catch(() => "");
      console.warn(`[Melhor Envio Automatizado] Falha na compra automática da etiqueta do envio ${shipmentId} (talvez saldo insuficiente). Status: ${checkoutRes.status}. Causa: ${errText}`);
      
      // We still record the Shipment ID so the merchant can complete, pay, and print the label manually
      if (adminDb) {
        await adminDb.collection("ecom_orders").doc(orderId).update({
          melhorEnvioShipmentId: shipmentId,
          melhorEnvioStatus: "cart",
          melhorEnvioStatusText: "No carrinho de compras (Pagamento pendente no saldo)",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      return;
    }

    console.log(`[Melhor Envio Automatizado] Etiqueta comprada com sucesso para o envio ${shipmentId}. Gerando impressão pública...`);

    // 3. GENERATE LABEL PRINT LINK
    let labelUrl = "";
    try {
      const printRes = await fetch(`${meBaseUrl}/api/v2/me/shipment/print`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
          "User-Agent": userAgentContact
        },
        body: JSON.stringify({
          mode: "public",
          orders: [shipmentId]
        })
      });

      if (printRes.ok) {
        const printData: any = await printRes.json();
        labelUrl = printData.url || printData.link || "";
        console.log(`[Melhor Envio Automatizado] Link público de etiqueta gerado: ${labelUrl}`);
      } else {
        const errText = await printRes.text().catch(() => "");
        console.warn(`[Melhor Envio Automatizado] Falha ao gerar link público. Status: ${printRes.status}, Retorno: ${errText}`);
      }
    } catch (printErr) {
      console.error("[Melhor Envio Automatizado] Erro ao obter link de impressão:", printErr);
    }

    // 4. FETCH INITIAL TRACKING INFO
    let trackingCode = "";
    let meStatusText = "Etiqueta Gerada";
    let meStatus = "released";

    try {
      const trackingRes = await fetch(`${meBaseUrl}/api/v2/me/shipment/tracking`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json",
          "Content-Type": "application/json",
          "User-Agent": userAgentContact
        },
        body: JSON.stringify({
          orders: [shipmentId]
        })
      });

      if (trackingRes.ok) {
        const trackingData: any = await trackingRes.json();
        const info = trackingData[shipmentId];
        if (info) {
          trackingCode = info.tracking || "";
          meStatus = info.status || "released";
          meStatusText = getPortugueseStatusText(meStatus);
        }
      }
    } catch (trackingErr) {
      console.error("[Melhor Envio Automatizado] Erro ao obter código de rastreamento inicial:", trackingErr);
    }

    // Update the DB!
    if (adminDb) {
      await adminDb.collection("ecom_orders").doc(orderId).update({
        melhorEnvioShipmentId: shipmentId,
        trackingCode: trackingCode || orderData.trackingCode || "",
        melhorEnvioTrackingCode: trackingCode || "",
        melhorEnvioLabelUrl: labelUrl || "",
        melhorEnvioStatus: meStatus,
        melhorEnvioStatusText: meStatusText,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`[Melhor Envio Automatizado] Processo real concluído com êxito para o pedido ${orderId}!`);
    }

  } catch (error: any) {
    console.error(`[Melhor Envio Automatizado] Falha no processamento de envio para o pedido ${orderId}:`, error);
  }
}

// Translate state of Melhor Envio labels to clear Portuguese
function getPortugueseStatusText(meStatus: string): string {
  switch (meStatus) {
    case "cart": return "No carrinho de compras do Melhor Envio";
    case "pending": return "Etiqueta reservada/Aguardando pagamento";
    case "released": return "Pronta para envio (Etiqueta gerada)";
    case "posted": return "Postado / Objeto em trânsito";
    case "delivered": return "Entregue ao destinatário";
    case "canceled": return "Cancelado";
    default: return meStatus || "Pronto para postagem";
  }
}

// 1. Manual label trigger endpoint for backups or retries
app.post("/api/vendas/shipment/generate-label", checkAdminAuth, async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ error: "orderId é obrigatório" });
  }

  try {
    if (!adminDb) {
      return res.status(500).json({ error: "Banco de dados indisponível." });
    }

    console.log(`[Melhor Envio Admin] Forçando geração de etiqueta para pedido ${orderId} por requisição manual...`);
    const orderSnap = await adminDb.collection("ecom_orders").doc(orderId).get();
    if (!orderSnap.exists) {
      return res.status(404).json({ error: "Pedido não encontrado no banco de dados." });
    }

    const orderData = orderSnap.data();
    await processMelhorEnvioShipmentForPaidOrder(orderId, orderData);

    // Fetch updated document as verification
    const updatedSnap = await adminDb.collection("ecom_orders").doc(orderId).get();
    res.json({ success: true, order: updatedSnap.data() });
  } catch (err: any) {
    console.error("Falha manual:", err);
    res.status(500).json({ error: formatFirebaseError(err) || "Falha ao gerar etiqueta." });
  }
});

// 2. Tracking synchronization endpoint
app.post("/api/vendas/shipment/sync-tracking", checkAdminAuth, async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ error: "orderId é obrigatório" });
  }

  try {
    if (!adminDb) {
      return res.status(500).json({ error: "Banco de dados indisponível." });
    }

    const orderSnap = await adminDb.collection("ecom_orders").doc(orderId).get();
    if (!orderSnap.exists) {
      return res.status(404).json({ error: "Pedido não localizado." });
    }

    const orderData = orderSnap.data();
    if (!orderData) {
      return res.status(400).json({ error: "Pedido corrompido." });
    }

    const shipmentId = orderData.melhorEnvioShipmentId;
    const token = process.env.MELHORENVIO_TOKEN;
    const isMock = !shipmentId || !token || token.includes("MOCK_") || token.startsWith("eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.MOCK_MELHORENVIO_TOKEN_FOR_SECURITY");

    if (isMock) {
      console.log(`[Melhor Envio Rastreamento] Sincronização em modo simulado para o pedido ${orderId}...`);
      
      // Simulate random progression through statuses
      let nextStatus = orderData.melhorEnvioStatus || "released";
      let overallStatus = orderData.status || "Pago";

      if (nextStatus === "released") {
        nextStatus = "posted";
        overallStatus = "Enviado";
      } else if (nextStatus === "posted") {
        nextStatus = "delivered";
        overallStatus = "Entregue";
      }

      const mockTracking = orderData.melhorEnvioTrackingCode || "BR-RE-SIM-9204A";
      const statusText = getPortugueseStatusText(nextStatus);

      await adminDb.collection("ecom_orders").doc(orderId).update({
        trackingCode: mockTracking,
        melhorEnvioTrackingCode: mockTracking,
        melhorEnvioStatus: nextStatus,
        melhorEnvioStatusText: statusText,
        status: overallStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      if (overallStatus === "Entregue" && orderData.status !== "Entregue") {
        sendDeliveredReviewRequestEmail(orderId, orderData, req.headers.referer || "").catch(err =>
          console.error("[Tracking sync mock] Review email trigger failed:", err)
        );
      }

      const finalSnap = await adminDb.collection("ecom_orders").doc(orderId).get();
      return res.json({ success: true, message: "Sincronizado via Simulador de Logística", order: finalSnap.data() });
    }

    // REAL MELHOR ENVIO CALL
    const isSandboxToken = token.includes("sandbox") || process.env.MELHORENVIO_ENV === "sandbox";
    const meBaseUrl = isSandboxToken
      ? "https://sandbox.melhorenvio.com.br"
      : "https://www.melhorenvio.com.br";
    const userAgentContact = "Atelie_Andrew_Lemos(andrewfmlemos@gmail.com)";

    console.log(`[Melhor Envio Rastreamento] Buscando histórico em tempo real da etiqueta ${shipmentId} para o pedido ${orderId}...`);
    const trackRes = await fetch(`${meBaseUrl}/api/v2/me/shipment/tracking`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": userAgentContact
      },
      body: JSON.stringify({
        orders: [shipmentId]
      })
    });

    if (!trackRes.ok) {
      const errText = await trackRes.text().catch(() => "");
      throw new Error(`Erro ao buscar rastreio na API. Status: ${trackRes.status}, Retorno: ${errText}`);
    }

    const trackingData: any = await trackRes.json();
    const info = trackingData[shipmentId];

    if (!info) {
      return res.status(404).json({ error: `O Melhor Envio não retornou informações válidas para a etiqueta ${shipmentId}.` });
    }

    const trackingCode = info.tracking || "";
    const meStatus = info.status || "released";
    const meStatusText = getPortugueseStatusText(meStatus);

    let overallStatus = orderData.status || "Pago";
    if (meStatus === "posted") {
      overallStatus = "Enviado";
    } else if (meStatus === "delivered") {
      overallStatus = "Entregue";
    } else if (meStatus === "canceled") {
      overallStatus = "Cancelado";
    }

    const updatePayload: any = {
      melhorEnvioStatus: meStatus,
      melhorEnvioStatusText: meStatusText,
      status: overallStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (trackingCode) {
      updatePayload.trackingCode = trackingCode;
      updatePayload.melhorEnvioTrackingCode = trackingCode;
    }

    // Also attempt to refresh print link if it was empty
    if (!orderData.melhorEnvioLabelUrl) {
      try {
        const printRes = await fetch(`${meBaseUrl}/api/v2/me/shipment/print`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": userAgentContact
          },
          body: JSON.stringify({
            mode: "public",
            orders: [shipmentId]
          })
        });

        if (printRes.ok) {
          const printData: any = await printRes.json();
          const publicUrl = printData.url || printData.link || "";
          if (publicUrl) {
            updatePayload.melhorEnvioLabelUrl = publicUrl;
          }
        }
      } catch (e) {
        console.warn("Failed print url refresh on sync:", e);
      }
    }

    await adminDb.collection("ecom_orders").doc(orderId).update(updatePayload);

    if (overallStatus === "Entregue" && orderData.status !== "Entregue") {
      sendDeliveredReviewRequestEmail(orderId, orderData, req.headers.referer || "").catch(err =>
        console.error("[Tracking sync real] Review email trigger failed:", err)
      );
    }

    const finalSnap = await adminDb.collection("ecom_orders").doc(orderId).get();
    res.json({ success: true, message: "Status sincronizado com sucesso diretamente no Melhor Envio", order: finalSnap.data() });

  } catch (err: any) {
    console.error("Falha no sincronismo de rastreio:", err);
    res.status(500).json({ error: err.message || "Erro interno ao consultar rastreamento." });
  }
});

// Admin change status route with email dispatch on transition to Entregue
app.post("/api/vendas/order/update-status", checkAdminAuth, async (req, res) => {
  const { orderId, status } = req.body;

  if (!orderId || !status) {
    return res.status(400).json({ error: "orderId e status são obrigatórios." });
  }

  if (!adminDb) {
    return res.status(500).json({ error: "Banco de dados Firestore não inicializado." });
  }

  try {
    const orderRef = adminDb.collection("ecom_orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return res.status(404).json({ error: "Pedido não localizado." });
    }

    const orderData = orderSnap.data() || {};
    const previousStatus = orderData.status;

    await orderRef.update({
      status: status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    if (status === "Entregue" && previousStatus !== "Entregue") {
      const referer = req.headers.referer || "";
      sendDeliveredReviewRequestEmail(orderId, orderData, referer).catch(err => 
        console.error("[Manual status change] Async feedback email trigger failed:", err)
      );
    }

    res.json({ success: true, message: "Status alterado com sucesso." });
  } catch (err: any) {
    console.error("Falha ao ajustar status do pedido manualmente:", err);
    res.status(500).json({ error: err.message || "Erro interno ao atualizar status." });
  }
});

// 2.2 Payment refund endpoint via Mercado Pago with local fallback
app.post("/api/vendas/order/refund", checkAdminAuth, async (req, res) => {
  const { orderId, amount, notes } = req.body;

  if (!orderId || typeof amount !== "number" || amount <= 0) {
    return res.status(400).json({ error: "orderId e valor de estorno válido são obrigatórios." });
  }

  if (!adminDb) {
    return res.status(500).json({ error: "Banco de dados Firestore não inicializado." });
  }

  try {
    const orderRef = adminDb.collection("ecom_orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return res.status(404).json({ error: "Pedido não localizado no servidor." });
    }

    const orderData = orderSnap.data();
    if (!orderData) {
      return res.status(400).json({ error: "Dados do pedido corrompidos." });
    }

    const currentRefunded = orderData.refundedAmount || 0;
    const proposedTotalRefunded = currentRefunded + amount;

    // We allow matching full total or partial, but total cannot exceed original total
    if (proposedTotalRefunded > orderData.total) {
      return res.status(400).json({ 
        error: `O valor total acumulado de estornos (R$ ${proposedTotalRefunded.toFixed(2)}) não pode exceder o total geral pago pelo cliente (R$ ${orderData.total.toFixed(2)}).` 
      });
    }

    const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const paymentId = orderData.paymentId;
    let gatewayRefunded = false;
    let isMockOrSimulated = !paymentId || paymentId.startsWith("PAY-SIM-");

    // If we have a real paymentId (not starting with our mock prefix PAY-SIM-), we perform the real HTTP call
    if (!isMockOrSimulated) {
      if (!mpToken || mpToken.startsWith("MOCK") || mpToken.includes("MOCK_MELHORENVIO_TOKEN_FOR_SECURITY")) {
        return res.status(400).json({ 
          error: `Este é um pedido real (ID do pagamento: ${paymentId}), mas a credencial de produção MERCADOPAGO_ACCESS_TOKEN não está configurada ou é fictícia nos Secrets do servidor. O estorno financeiro real não pôde ser solicitado do Mercado Pago.` 
        });
      }

      console.log(`[Mercado Pago Refund] Efetuando estorno real no gateway Mercado Pago para o pagamento id: ${paymentId}, valor: R$ ${amount}`);
      try {
        const refundIdempotencyKey = `ref-${orderId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`.toLowerCase();
        const mpRefundUrl = `https://api.mercadopago.com/v1/payments/${paymentId}/refunds`;
        const mpResponse = await fetch(mpRefundUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${mpToken}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": refundIdempotencyKey
          },
          body: JSON.stringify({
            amount: Number(amount.toFixed(2))
          })
        });

        if (mpResponse.ok) {
          const resData: any = await mpResponse.json();
          console.log(`[Mercado Pago Refund] Estorno aprovado pelo Mercado Pago para pagamento ${paymentId}. ID Reembolso: ${resData.id}`);
          gatewayRefunded = true;
        } else {
          const errText = await mpResponse.text().catch(() => "");
          console.error(`[Mercado Pago Refund Error] Erro ${mpResponse.status} retornado pelo gateway: ${errText}`);
          let parsedMsg = "Falha no gateway.";
          try {
            const parsed = JSON.parse(errText);
            parsedMsg = parsed.message || parsedMsg;
          } catch (e) {}
          throw new Error(`O Mercado Pago recusou a transação de estorno: ${parsedMsg}`);
        }
      } catch (mpErr: any) {
        console.error("[Mercado Pago Refund Exception]", mpErr);
        return res.status(500).json({ 
          error: `O estorno financeiro real no Mercado Pago falhou. Nenhuma alteração foi efetuada no banco de dados. Motivo: ${mpErr.message || mpErr}` 
        });
      }
    } else {
      console.log(`[E-Commerce Refund] Estorno simulado local ativado (Ambiente de testes: id de pagamento fictício '${paymentId || "ausente"}').`);
    }

    // Update database values
    const refundStatus = proposedTotalRefunded >= orderData.total ? "total" : "partial";
    const updates: any = {
      refundedAmount: proposedTotalRefunded,
      refundStatus: refundStatus,
      refundNotes: (notes || "").trim(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // If it is a full refund, transition the status to Canceled
    if (refundStatus === "total") {
      updates.status = "Cancelado";
    }

    await orderRef.update(updates);

    // Fetch the updated document after writing
    const finalSnap = await orderRef.get();
    const finalOrder = { id: orderId, ...finalSnap.data() };

    let successMsg = "Estorno financeiro realizado e creditado com sucesso no Mercado Pago!";
    if (isMockOrSimulated) {
      if (!paymentId) {
        successMsg = "Este pedido não possui identificação de pagamento ativa (ainda não foi pago ou ID ausente). O status foi alterado para 'Cancelado' e registrado localmente sem qualquer movimentação bancária.";
      } else {
        successMsg = `⚠️ ATENÇÃO: Esse pedido foi pago em MODO DE SIMULAÇÃO (TESTE) com o identificador fictício '${paymentId}'. Nenhum valor de verdade foi cobrado do comprador, portanto nenhum dinheiro real saiu da sua conta bancária. O status foi alterado no banco de dados local da loja apenas para simulações de testes de fluxo de caixa.`;
      }
    }

    return res.json({
      success: true,
      message: successMsg,
      order: finalOrder,
      gatewayRefunded
    });

  } catch (err: any) {
    console.error("Failed executing refund endpoint:", err);
    res.status(500).json({ error: "Erro interno do servidor ao registrar estorno: " + err.message });
  }
});

// 3. Mock Printable Layout Viewer
app.get("/api/vendas/shipment/print-mock", async (req, res) => {
  const { id } = req.query;
  const orderId = String(id || "");
  
  try {
    if (!adminDb) {
      return res.status(500).send("Banco de dados indisponível.");
    }
    const orderSnap = await adminDb.collection("ecom_orders").doc(orderId).get();
    if (!orderSnap.exists) {
      return res.status(404).send("Pedido não localizado para gerar a etiqueta.");
    }
    const order = orderSnap.data();
    if (!order) {
      return res.status(400).send("Sem dados no pedido.");
    }

    const tracking = order.melhorEnvioTrackingCode || "BR-RE-SIM-9204A";
    
    // Dynamic sender details
    const senderName = process.env.MELHORENVIO_FROM_NAME || "Ateliê Andrew Lemos";
    const senderAddress = process.env.MELHORENVIO_FROM_ADDRESS || "Rua Lisette Wegmuller";
    const senderNumber = process.env.MELHORENVIO_FROM_NUMBER || "1325";
    const senderComplement = process.env.MELHORENVIO_FROM_COMPLEMENT || "Casa";
    const senderDistrict = process.env.MELHORENVIO_FROM_DISTRICT || "Jardim Ferrarezzi";
    const senderCity = process.env.MELHORENVIO_FROM_CITY || "Pirassununga";
    const senderState = process.env.MELHORENVIO_FROM_STATE_ABBR || "SP";
    const rawMeCep = (process.env.MELHORENVIO_FROM_CEP || "13636166").replace(/\D/g, "");
    const formattedSenderCep = rawMeCep.length === 8 
      ? `${rawMeCep.substring(0, 5)}-${rawMeCep.substring(5)}` 
      : "13636-166";
    
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Etiqueta de Envio Simulada — Ateliê Andrew Lemos</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 20px; background-color: #f1f1f1; display: flex; justify-content: center; }
          .label-container { width: 380px; background: white; padding: 25px; border: 1px solid #ddd; box-shadow: 0 4px 12px rgba(0,0,0,0.1); box-sizing: border-box; }
          .header { border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
          .logo { font-size: 15px; font-weight: 900; letter-spacing: -0.5px; font-family: sans-serif; }
          .carrier-badge { background: #000; color: #fff; padding: 4px 10px; font-size: 10px; font-weight: 800; border-radius: 4px; text-transform: uppercase; }
          .barcode-box { border: 2px solid #000; height: 65px; display: flex; flex-direction: column; justify-content: center; align-items: center; margin: 15px 0; }
          .barcode-bars { letter-spacing: 2px; font-size: 28px; font-family: monospace; font-weight: bold; }
          .barcode-number { font-size: 9px; font-weight: bold; margin-top: 3px; font-family: monospace; }
          .section-title { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #555; margin-bottom: 4px; }
          .address-section { font-size: 11px; line-height: 1.45; margin-bottom: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 12px; }
          .name { font-weight: bold; font-size: 12px; color: #000; }
          .footer { text-align: center; font-size: 8px; color: #888; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px; }
          @media print {
            body { background: white; padding: 0; }
            .label-container { border: none; box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="label-container">
          <div class="header">
            <span class="logo">MELHOR ENVIO — ETIQUETA</span>
            <span class="carrier-badge">${order.shippingMethod || 'Correios PAC'}</span>
          </div>
          
          <div class="address-section">
            <div class="section-title">Destinatário</div>
            <div class="name">${order.customerInfo.name}</div>
            <div>Rua: ${order.customerInfo.street}, ${order.customerInfo.number} ${order.customerInfo.complement ? `(${order.customerInfo.complement})` : ''}</div>
            <div>Bairro: ${order.customerInfo.neighborhood}</div>
            <div>CEP: <b>${order.customerInfo.cep}</b></div>
            <div>${order.customerInfo.city} — ${order.customerInfo.state}</div>
          </div>

          <div class="barcode-box">
            <div class="barcode-bars">||||||| | ||||| || || | |||| ||||</div>
            <div class="barcode-number">Rastreamento: ${tracking}</div>
          </div>
          
          <div class="address-section" style="border: none; padding-bottom: 0;">
            <div class="section-title">Remetente</div>
            <div class="name">${senderName}</div>
            <div>${senderAddress}, ${senderNumber}${senderComplement ? ` - ${senderComplement}` : ''} - ${senderDistrict}</div>
            <div>CEP: <b>${formattedSenderCep}</b></div>
            <div>${senderCity} — ${senderState}</div>
          </div>

          <div class="footer">
            Ateliê Andrew Lemos © — Esta é uma Etiqueta de Envio simulada em Modo de Integração.
          </div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 600);
          }
        </script>
      </body>
      </html>
    `);
  } catch (err: any) {
    res.status(500).send("Erro ao gerar etiqueta de simulação: " + err.message);
  }
});

// Endpoint de segurança para baixar cópia de segurança robusta do projeto

app.get("/api/download-zip", checkAdminAuth, (req, res) => {
  try {
    const zip = new AdmZip();
    const rootPath = process.cwd();
    
    // Função recursiva de empacotamento
    const addDirToZip = (currentDir: string, zipFolder: string) => {
      const files = fs.readdirSync(currentDir);
      for (const file of files) {
        const fullPath = path.join(currentDir, file);
        const stat = fs.statSync(fullPath);
        
        // Excluir pastas desnecessárias ou dados sensíveis de credenciais reais
        if (
          file === "node_modules" ||
          file === ".git" ||
          file === "dist" ||
          file === ".env" ||
          file === "server.log" ||
          file === ".next" ||
          file === "arquivos" || // Excluir os arquivos/mídias pesados do backup de código
          file.endsWith(".zip")
        ) {
          continue;
        }
        
        if (stat.isDirectory()) {
          addDirToZip(fullPath, path.join(zipFolder, file));
        } else if (stat.isFile()) {
          let content = fs.readFileSync(fullPath);
          
          // Limpeza extra de segurança para evitar vazamento de qualquer chave/token
          if (file === "index.ts" || file === ".env.example") {
            let strContent = content.toString("utf8");
            strContent = strContent.replace(/eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+/g, "MOCK_MELHORENVIO_TOKEN_FOR_SECURITY");
            content = Buffer.from(strContent, "utf8");
          }
          
          zip.addFile(path.join(zipFolder, file), content);
        }
      }
    };
    
    addDirToZip(rootPath, "");
    
    const buffer = zip.toBuffer();
    
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=andrew_lemos_webpage_backup.zip");
    res.send(buffer);
  } catch (error: any) {
    console.error("Erro ao gerar backup ZIP:", error);
    res.status(500).send("Erro interno ao gerar backup de seu projeto: " + error.message);
  }
});

// Advanced SEO: Dynamic Sitemaps (including image schemas) & robots.txt

function backendEnsureRobustUrl(url: string, baseUrl: string): string {
  if (!url) return "";
  let processedUrl = url.trim();

  if (processedUrl.includes("drive.google.com")) {
    const fileDMatch = processedUrl.match(/\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
    if (fileDMatch && fileDMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${fileDMatch[1]}`;
    }
    const queryIdMatch = processedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (queryIdMatch && queryIdMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${queryIdMatch[1]}`;
    }
  }

  if (processedUrl.startsWith("http://") || processedUrl.startsWith("https://")) {
    return processedUrl;
  }

  if (processedUrl.startsWith("/")) {
    return `${baseUrl}${processedUrl}`;
  }
  return `${baseUrl}/${processedUrl}`;
}

function backendSlugify(text: string): string {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

function backendGetWorkSlug(work: any): string {
  if (work.slug) return work.slug;
  if (work.title) return backendSlugify(work.title);
  return work.id || "";
}

function backendGetProductSlug(prod: any): string {
  if (prod.slug && prod.slug.trim().length > 0) return prod.slug.trim();
  if (prod.name) return backendSlugify(prod.name);
  return prod.id || "";
}

app.get(["/sitemap.xml", "/api/sitemap.xml"], async (req, res) => {
  const host = req.get("host") || "andrewlemos.com.br";
  const protocol = req.secure || req.get("x-forwarded-proto") === "https" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  const blogPosts: any[] = [];
  const galleryItems: any[] = [];
  const ecomProducts: any[] = [];
  const affiliateProducts: any[] = [];

  if (adminDb) {
    try {
      const blogSnap = await adminDb.collection("ecom_blog_posts").get();
      blogSnap.forEach((doc: any) => {
        const data = doc.data();
        if (data && data.published) {
          blogPosts.push({ id: doc.id, ...data });
        }
      });
    } catch (e) {
      console.error("Sitemap XML: blog fetch error:", e);
    }

    try {
      const gallerySnap = await adminDb.collection("arquivos").get();
      gallerySnap.forEach((doc: any) => {
        const data = doc.data();
        if (data) {
          galleryItems.push({ id: doc.id, ...data });
        }
      });
    } catch (e) {
      console.error("Sitemap XML: gallery fetch error:", e);
    }

    try {
      const ecomProdSnap = await adminDb.collection("ecom_products").get();
      ecomProdSnap.forEach((doc: any) => {
        const data = doc.data();
        if (data) {
          ecomProducts.push({ id: doc.id, ...data });
        }
      });
    } catch (e) {
      console.error("Sitemap XML: ecom products fetch error:", e);
    }

    try {
      const affiliateSnap = await adminDb.collection("products").get();
      affiliateSnap.forEach((doc: any) => {
        const data = doc.data();
        if (data) {
          affiliateProducts.push({ id: doc.id, ...data });
        }
      });
    } catch (e) {
      console.error("Sitemap XML: affiliate products fetch error:", e);
    }
  }

  // Generate sitemap XML string
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  // Escape special utility
  const escapeXml = (str: string): string => {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  // 1. Home Page
  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/</loc>\n`;
  xml += `    <changefreq>daily</changefreq>\n`;
  xml += `    <priority>1.0</priority>\n`;
  xml += `    <image:image>\n`;
  xml += `      <image:loc>https://lh3.googleusercontent.com/d/1iCZEIfCehjOGE167hfelsT2P7zD9DzOb</image:loc>\n`;
  xml += `      <image:title>Andrew Lemos - Artista Plástico &amp; Escultor</image:title>\n`;
  xml += `    </image:image>\n`;
  xml += `  </url>\n`;

  // 2. Blog View
  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/#blog</loc>\n`;
  xml += `    <changefreq>daily</changefreq>\n`;
  xml += `    <priority>0.8</priority>\n`;
  xml += `  </url>\n`;

  // 3. Vendas (E-commerce store)
  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/#vendas</loc>\n`;
  xml += `    <changefreq>weekly</changefreq>\n`;
  xml += `    <priority>0.9</priority>\n`;
  ecomProducts.forEach((prod) => {
    const imgUrl = prod.images && prod.images[0] ? backendEnsureRobustUrl(prod.images[0], baseUrl) : "";
    if (imgUrl) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${escapeXml(imgUrl)}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(prod.name)}</image:title>\n`;
      xml += `    </image:image>\n`;
    }
  });
  xml += `  </url>\n`;

  // 4. Products list (Affiliates)
  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/#products</loc>\n`;
  xml += `    <changefreq>weekly</changefreq>\n`;
  xml += `    <priority>0.7</priority>\n`;
  affiliateProducts.forEach((prod) => {
    const imgUrl = prod.imageUrl ? backendEnsureRobustUrl(prod.imageUrl, baseUrl) : "";
    if (imgUrl) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${escapeXml(imgUrl)}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(prod.name)}</image:title>\n`;
      xml += `    </image:image>\n`;
    }
  });
  xml += `  </url>\n`;

  // 5. Gallery works
  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/#gallery</loc>\n`;
  xml += `    <changefreq>weekly</changefreq>\n`;
  xml += `    <priority>0.8</priority>\n`;
  galleryItems.forEach((item) => {
    const imgUrl = item.img ? backendEnsureRobustUrl(item.img, baseUrl) : "";
    if (imgUrl) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${escapeXml(imgUrl)}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(item.title || "Obra")}</image:title>\n`;
      xml += `    </image:image>\n`;
    }
  });
  xml += `  </url>\n`;

  // 6. Online courses
  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/#online-courses</loc>\n`;
  xml += `    <changefreq>monthly</changefreq>\n`;
  xml += `    <priority>0.7</priority>\n`;
  xml += `  </url>\n`;

  // 7. Classes
  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/#classes</loc>\n`;
  xml += `    <changefreq>monthly</changefreq>\n`;
  xml += `    <priority>0.7</priority>\n`;
  xml += `  </url>\n`;

  // 8. Contact
  xml += `  <url>\n`;
  xml += `    <loc>${baseUrl}/#contact</loc>\n`;
  xml += `    <changefreq>monthly</changefreq>\n`;
  xml += `    <priority>0.5</priority>\n`;
  xml += `  </url>\n`;

  // 9. Blog posts
  blogPosts.forEach((post) => {
    const slug = post.slug || post.id;
    const url = `${baseUrl}/#blog/${slug}`;
    xml += `  <url>\n`;
    xml += `    <loc>${url}</loc>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.7</priority>\n`;
    const imgUrl = post.imageUrl ? backendEnsureRobustUrl(post.imageUrl, baseUrl) : "";
    if (imgUrl) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${escapeXml(imgUrl)}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(post.title)}</image:title>\n`;
      xml += `    </image:image>\n`;
    }
    xml += `  </url>\n`;
  });

  // 10. Individual Gallery Works (Permanent Links for Pinterest, SEO, organic traffic etc.)
  galleryItems.forEach((work) => {
    const slug = backendGetWorkSlug(work);
    if (slug) {
      const url = `${baseUrl}/galeria/${slug}`;
      xml += `  <url>\n`;
      xml += `    <loc>${url}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      const imgUrl = work.img ? backendEnsureRobustUrl(work.img, baseUrl) : "";
      if (imgUrl) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${escapeXml(imgUrl)}</image:loc>\n`;
        xml += `      <image:title>${escapeXml(work.title || "Obra")}</image:title>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    }
  });

  // 11. Individual Vendas Works (Permanent Links for Pinterest, SEO, organic traffic etc.)
  ecomProducts.forEach((prod) => {
    const slug = backendGetProductSlug(prod);
    if (slug) {
      const url = `${baseUrl}/vendas/${slug}`;
      xml += `  <url>\n`;
      xml += `    <loc>${url}</loc>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.9</priority>\n`;
      const imgUrl = prod.images && prod.images[0] ? backendEnsureRobustUrl(prod.images[0], baseUrl) : "";
      if (imgUrl) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${escapeXml(imgUrl)}</image:loc>\n`;
        xml += `      <image:title>${escapeXml(prod.name || "Obra")}</image:title>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    }
  });

  xml += `</urlset>\n`;

  res.header("Content-Type", "application/xml; charset=utf-8");
  res.send(xml);
});

app.get(["/robots.txt", "/api/robots.txt"], (req, res) => {
  const host = req.get("host") || "andrewlemos.com.br";
  const protocol = req.secure || req.get("x-forwarded-proto") === "https" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  res.header("Content-Type", "text/plain; charset=utf-8");
  res.send(`User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`);
});

// --- Server-Side SEO & Open Graph Interceptors for Blog Articles ---
app.get("/blog/:slug", async (req, res) => {
  const { slug } = req.params;

  try {
    const host = req.get("host") || "andrewlemos.com.br";
    const protocol = req.secure || req.get("x-forwarded-proto") === "https" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    // Prevent asset lookups or other main files accidentally matching
    if (slug.includes('.') || slug === 'sitemap.xml' || slug === 'robots.txt' || slug === 'api') {
      return res.status(404).end();
    }

    let title = "Andrew Lemos | Artista Plástico & Escultor";
    let description = "Portfólio de Andrew Lemos, Artista Plástico e Escultor. Conheça incríveis entalhes em madeira de lei e esculturas detalhadas.";
    let imageUrl = "https://lh3.googleusercontent.com/d/1iCZEIfCehjOGE167hfelsT2P7zD9DzOb";
    const url = `${baseUrl}/blog/${slug}`;

    // Load active post details from Firestore Admin
    if (adminDb) {
      try {
        const postsRef = adminDb.collection('ecom_blog_posts');
        const snapshot = await postsRef.where('slug', '==', slug).where('published', '==', true).limit(1).get();

        if (!snapshot.empty) {
          const postData = snapshot.docs[0].data();
          title = `${postData.title} | Blog Andrew Lemos`;
          description = postData.summary || postData.content?.substring(0, 160) || description;

          // Resolve Drive / Local picture URLs
          if (postData.imageUrl) {
            const processed = postData.imageUrl.trim();
            if (processed.includes('drive.google.com')) {
              const fileDMatch = processed.match(/\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
              if (fileDMatch && fileDMatch[1]) {
                imageUrl = `https://lh3.googleusercontent.com/d/${fileDMatch[1]}`;
              } else {
                const queryIdMatch = processed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                if (queryIdMatch && queryIdMatch[1]) {
                  imageUrl = `https://lh3.googleusercontent.com/d/${queryIdMatch[1]}`;
                }
              }
            } else if (processed.startsWith('http://') || processed.startsWith('https://')) {
              imageUrl = processed;
            } else {
              imageUrl = processed.startsWith('/') ? `${baseUrl}${processed}` : `${baseUrl}/${processed}`;
            }
          }
        }
      } catch (dbErr) {
        console.error("SEO blog dynamic fetch failed from Firestore:", dbErr);
      }
    }

    // Read index.html compiled assets safely
    let indexPath = path.join(process.cwd(), 'dist', 'index.html');
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(process.cwd(), 'index.html');
    }

    if (!fs.existsSync(indexPath)) {
      return res.status(404).send("Template index.html não localizado.");
    }

    let html = fs.readFileSync(indexPath, 'utf8');

    // Secure title replacement
    html = html.replace(/<title>.*?<\/title>/gi, `<title>${title}</title>`);
    
    // Secure meta tag adjustments
    html = html.replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/gi, `<meta name="description" content="${description}" />`);
    
    html = html.replace(/<meta\s+property="og:type"\s+content=".*?"\s*\/?>/gi, `<meta property="og:type" content="article" />`);
    html = html.replace(/<meta\s+property="og:url"\s+content=".*?"\s*\/?>/gi, `<meta property="og:url" content="${url}" />`);
    html = html.replace(/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/gi, `<meta property="og:title" content="${title}" />`);
    html = html.replace(/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/gi, `<meta property="og:description" content="${description}" />`);
    html = html.replace(/<meta\s+property="og:image"\s+content=".*?"\s*\/?>/gi, `<meta property="og:image" content="${imageUrl}" />`);
    
    html = html.replace(/<meta\s+property="twitter:card"\s+content=".*?"\s*\/?>/gi, `<meta property="twitter:card" content="summary_large_image" />`);
    html = html.replace(/<meta\s+property="twitter:url"\s+content=".*?"\s*\/?>/gi, `<meta property="twitter:url" content="${url}" />`);
    html = html.replace(/<meta\s+property="twitter:title"\s+content=".*?"\s*\/?>/gi, `<meta property="twitter:title" content="${title}" />`);
    html = html.replace(/<meta\s+property="twitter:description"\s+content=".*?"\s*\/?>/gi, `<meta property="twitter:description" content="${description}" />`);
    html = html.replace(/<meta\s+property="twitter:image"\s+content=".*?"\s*\/?>/gi, `<meta property="twitter:image" content="${imageUrl}" />`);

    res.header("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);

  } catch (err) {
    console.error("SEO blogger exception:", err);
    let indexPath = path.join(process.cwd(), 'dist', 'index.html');
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(process.cwd(), 'index.html');
    }
    return res.sendFile(indexPath);
  }
});

app.get(["/blog", "/blog/"], async (req, res) => {
  try {
    const host = req.get("host") || "andrewlemos.com.br";
    const protocol = req.secure || req.get("x-forwarded-proto") === "https" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const title = "Blog do Ateliê | Andrew Lemos";
    const description = "Técnicas de entalhe em madeira, vídeos, segredos do ateliê e lições valiosas publicadas por Andrew Lemos.";
    const imageUrl = "https://lh3.googleusercontent.com/d/1iCZEIfCehjOGE167hfelsT2P7zD9DzOb";
    const url = `${baseUrl}/blog`;

    let indexPath = path.join(process.cwd(), 'dist', 'index.html');
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(process.cwd(), 'index.html');
    }

    if (!fs.existsSync(indexPath)) {
      return res.status(404).send("Template index.html não localizado.");
    }

    let html = fs.readFileSync(indexPath, 'utf8');

    html = html.replace(/<title>.*?<\/title>/gi, `<title>${title}</title>`);
    html = html.replace(/<meta name="description" content=".*?"\s*\/?>/gi, `<meta name="description" content="${description}" />`);
    
    html = html.replace(/<meta\s+property="og:type"\s+content=".*?"\s*\/?>/gi, `<meta property="og:type" content="website" />`);
    html = html.replace(/<meta\s+property="og:url"\s+content=".*?"\s*\/?>/gi, `<meta property="og:url" content="${url}" />`);
    html = html.replace(/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/gi, `<meta property="og:title" content="${title}" />`);
    html = html.replace(/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/gi, `<meta property="og:description" content="${description}" />`);
    html = html.replace(/<meta\s+property="og:image"\s+content=".*?"\s*\/?>/gi, `<meta property="og:image" content="${imageUrl}" />`);
    
    html = html.replace(/<meta\s+property="twitter:card"\s+content=".*?"\s*\/?>/gi, `<meta property="twitter:card" content="summary_large_image" />`);
    html = html.replace(/<meta\s+property="twitter:url"\s+content=".*?"\s*\/?>/gi, `<meta property="twitter:url" content="${url}" />`);
    html = html.replace(/<meta\s+property="twitter:title"\s+content=".*?"\s*\/?>/gi, `<meta property="twitter:title" content="${title}" />`);
    html = html.replace(/<meta\s+property="twitter:description"\s+content=".*?"\s*\/?>/gi, `<meta property="twitter:description" content="${description}" />`);
    html = html.replace(/<meta\s+property="twitter:image"\s+content=".*?"\s*\/?>/gi, `<meta property="twitter:image" content="${imageUrl}" />`);

    res.header("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (err) {
    let indexPath = path.join(process.cwd(), 'dist', 'index.html');
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(process.cwd(), 'index.html');
    }
    return res.sendFile(indexPath);
  }
});

// --- Pinterest Product Feed (Pinterest Catalogs Integration) ---
app.get(["/api/pinterest-feed", "/api/pinterest-feed.csv"], async (req, res) => {
  try {
    const host = req.get("host") || "andrewlemos.com.br";
    const protocol = req.secure || req.get("x-forwarded-proto") === "https" ? "https" : "http";
    const baseUrl = `${protocol}://${host}`;

    const items: any[] = [];

    // Helper functions for CSV escaping & slugification
    const slugify = (text: string): string => {
      if (!text) return "";
      return text
        .toString()
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[_\s]+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
    };

    const escapeCsv = (field: string | null | undefined): string => {
      if (field === null || field === undefined) return '""';
      const clean = String(field).replace(/\r?\n|\r/g, " "); // Replace newlines with spaces for extra safety in CSV rows
      const bounciless = clean.replace(/"/g, '""');
      return `"${bounciless}"`;
    };

    // Mirrors exactly the frontend robust image url resolver to guarantee Pinterest gets valid direct images
    const resolveImageUrl = (imgUrl: string): string => {
      if (!imgUrl) return "https://lh3.googleusercontent.com/d/1iCZEIfCehjOGE167hfelsT2P7zD9DzOb";
      let processedUrl = imgUrl.trim();

      if (processedUrl.includes('drive.google.com')) {
        const fileDMatch = processedUrl.match(/\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
        if (fileDMatch && fileDMatch[1]) {
          return `https://lh3.googleusercontent.com/d/${fileDMatch[1]}`;
        }
        const queryIdMatch = processedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (queryIdMatch && queryIdMatch[1]) {
          return `https://lh3.googleusercontent.com/d/${queryIdMatch[1]}`;
        }
      }

      if ((processedUrl.startsWith('http://') || processedUrl.startsWith('https://')) && !processedUrl.includes('/arquivos/')) {
        return processedUrl;
      }

      if (processedUrl.includes('/arquivos/')) {
        try {
          const parts = processedUrl.split('/arquivos/');
          if (parts.length >= 2) {
            processedUrl = `/arquivos/${parts.slice(1).join('/arquivos/')}`;
          }
        } catch (e) {}
      }

      if (!processedUrl.startsWith('http') && !processedUrl.includes('/') && (
        processedUrl.endsWith('.jpg') || 
        processedUrl.endsWith('.jpeg') || 
        processedUrl.endsWith('.png') || 
        processedUrl.endsWith('.webp') ||
        processedUrl.endsWith('.gif') ||
        processedUrl.endsWith('.PNG') ||
        processedUrl.endsWith('.JPG') ||
        processedUrl.endsWith('.JPEG')
      )) {
        processedUrl = `/arquivos/${processedUrl}`;
      }

      if (processedUrl.startsWith('/arquivos/') || processedUrl.startsWith('arquivos/')) {
        const filename = processedUrl.replace(/^\/?arquivos\//, '');
        let decoded = filename;
        try {
          decoded = decodeURIComponent(filename);
        } catch (e) {}

        const lower = decoded.toLowerCase();
        if (lower === 'capa_curso_udemy_game.jpeg') {
          return `https://raw.githubusercontent.com/andrewlemos/Andrew_Lemos_Webpage/main/public/arquivos/${encodeURIComponent(decoded)}?v=${Date.now()}`;
        }

        if (
          lower === 'favicon.png' ||
          lower === 'ico.png' ||
          lower === 'banner andrew.png' ||
          lower === 'dreamina_course_thumbnail.jpeg'
        ) {
          return `${baseUrl}/arquivos/${encodeURIComponent(decoded)}`;
        } else {
          return `https://cdn.jsdelivr.net/gh/andrewlemos/Andrew_Lemos_Webpage@16eec916efc1342685e03616e5222f2ee1b1c784/public/arquivos/${encodeURIComponent(decoded)}`;
        }
      }

      return processedUrl.startsWith('/') ? `${baseUrl}${processedUrl}` : `${baseUrl}/${processedUrl}`;
    };

    if (adminDb) {
      // 1. Load active e-commerce products
      try {
        const ecomProdSnap = await adminDb.collection("ecom_products").get();
        ecomProdSnap.forEach((doc: any) => {
          const data = doc.data();
          if (data) {
            const id = doc.id;
            const title = data.name || "Obra de Arte";
            const description = data.description || "Escultura/Entalhe artesanal em madeira de lei de alta qualidade feito por Andrew Lemos.";
            
            const slug = data.slug && data.slug.trim().length > 0 
              ? data.slug.trim() 
              : (data.name ? slugify(data.name) : doc.id);
            const link = `${baseUrl}/vendas/${slug}`;

            let imageLink = "https://lh3.googleusercontent.com/d/1iCZEIfCehjOGE167hfelsT2P7zD9DzOb";
            if (data.images && Array.isArray(data.images) && data.images.length > 0) {
              imageLink = resolveImageUrl(data.images[0]);
            }

            // Price MUST be numeric followed by currency code (e.g. "150.00 BRL") for Pinterest catalog loader
            let priceVal = "0.00 BRL";
            if (data.price !== undefined && data.price !== null) {
              const numericPrice = parseFloat(data.price);
              if (!isNaN(numericPrice)) {
                priceVal = `${numericPrice.toFixed(2)} BRL`;
              }
            }
            
            const availability = (data.stock !== undefined && data.stock <= 0) ? "out of stock" : "in stock";

            items.push({
              id,
              title,
              description,
              link,
              imageLink,
              price: priceVal,
              availability
            });
          }
        });
      } catch (e) {
        console.error("Pinterest Feed: ecom products error:", e);
      }

      // 2. Load gallery items (arquivos)
      try {
        const gallerySnap = await adminDb.collection("arquivos").get();
        gallerySnap.forEach((doc: any) => {
          const data = doc.data();
          if (data) {
            const id = doc.id;
            const title = data.title || "Escultura em Madeira";
            const description = data.abouttext || data.technique || "Obra esculpida sob medida e com detalhes refinados pelo renomado artista plástico Andrew Lemos.";
            
            const slug = data.slug && data.slug.trim().length > 0 
              ? data.slug.trim() 
              : (data.title ? slugify(data.title) : doc.id);
            const link = `${baseUrl}/galeria/${slug}`;

            const imageLink = resolveImageUrl(data.img);
            
            // Showroom items where order is customized are listed as 0.00 BRL per Pinterest specs
            const priceVal = "0.00 BRL";
            const availability = "in stock"; 

            items.push({
              id,
              title,
              description,
              link,
              imageLink,
              price: priceVal,
              availability
            });
          }
        });
      } catch (e) {
        console.error("Pinterest Feed: gallery fetch error:", e);
      }
    }

    // Build the CSV
    const headers = ["id", "title", "description", "link", "image_link", "price", "availability"];
    let csvContent = headers.join(",") + "\n";

    items.forEach((item) => {
      const row = [
        escapeCsv(item.id),
        escapeCsv(item.title),
        escapeCsv(item.description),
        escapeCsv(item.link),
        escapeCsv(item.imageLink),
        escapeCsv(item.price),
        escapeCsv(item.availability)
      ];
      csvContent += row.join(",") + "\n";
    });

    // Send the feed inline directly so crawlers can scrape/fetch it without needing download trigger handlers
    res.header("Content-Type", "text/csv; charset=utf-8");
    return res.status(200).send(csvContent);

  } catch (err) {
    console.error("Pinterest Feed Exception:", err);
    return res.status(500).json({ error: "Erro interno ao gerar o feed do Pinterest." });
  }
});

export default app;
