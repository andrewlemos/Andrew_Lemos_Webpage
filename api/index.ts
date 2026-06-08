import express from "express";
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
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

  let appInstance;
  if (admin.apps.length === 0) {
    appInstance = admin.initializeApp({
      projectId: firebaseConfig.projectId
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

  // Get origin CEP from environment variable or default to "13630000" (Pirassununga). 
  // Strip any non-digits before sending to the API.
  const fromCep = (process.env.MELHORENVIO_FROM_CEP || "13630000").replace(/\D/g, "");

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
        // Filter out services with errors and format cleanly
        const parsedServices = results
          .filter((srv: any) => srv.price && !srv.error)
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

// 2. Checkout Creation Endpoint (PagSeguro integration or virtual sandbox)
app.post("/api/vendas/checkout", async (req, res) => {
  const { userId, customerInfo, items, shippingMethod, shippingCost } = req.body;
  
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
    return res.status(500).json({ error: "Erro de banco de dados ao verificar estoque: " + err.message });
  }

  // Calculate Subtotal and Total
  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  const total = subtotal + Number(shippingCost);

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
      total: Number(total),
      status: "Aguardando pagamento",
      paymentId: "",
      trackingCode: "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await adminDb.collection("ecom_orders").doc(orderId).set(orderDoc);
    console.log(`[Pedido Salvo] Pedido ${orderId} registrado com total de R$ ${total}`);
  } catch (err: any) {
    console.error("Erro ao salvar pedido no Firestore:", err);
    return res.status(500).json({ error: "Erro interno ao cadastrar o pedido no banco de dados: " + err.message });
  }

  // Check Mercado Pago Token (MERCADOPAGO_ACCESS_TOKEN)
  const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

  if (!mpAccessToken) {
    console.log(`[Mercado Pago] Token MERCADOPAGO_ACCESS_TOKEN ausente. Redirecionando pedido ${orderId} para simulador virtual...`);
    return res.json({
      success: true,
      orderId,
      gateway: "Virtual Simulator Gateway",
      redirectUrl: `/vendas/checkout/pay?id=${orderId}`
    });
  }

  // Implement official Mercado Pago Preferences API (Checkout Pro) registration
  try {
    const mpPrefUrl = "https://api.mercadopago.com/checkout/preferences";
    
    // items mapping according to Mercado Pago JSON schema
    const mpItems = items.map((itm: any) => ({
      id: itm.productId,
      title: itm.name,
      quantity: Number(itm.quantity),
      unit_price: Number(itm.price),
      currency_id: "BRL"
    }));

    // If there is shipping, we include shipping as a separate item to preserve correct total
    if (shippingCost && Number(shippingCost) > 0) {
      mpItems.push({
        id: "shipping-fee",
        title: `Frete: ${shippingMethod}`,
        quantity: 1,
        unit_price: Number(shippingCost),
        currency_id: "BRL"
      });
    }

    const host = req.get("host") || "localhost:3000";
    // Force HTTPS protocol for Mercado Pago because auto_return strictly requires HTTPS URLs.
    // Cloud Run and other reverse proxies terminate SSL, sending the requests as "http" internally,
    // which results in a status 400 validation error from Mercado Pago if we construct baseUrl using req.protocol.
    const baseUrl = `https://${host}`;

    const mpBody = {
      items: mpItems,
      payer: {
        name: customerInfo.name,
        email: customerInfo.email
      },
      back_urls: {
        success: `${baseUrl}/vendas/checkout/confirm?id=${orderId}`,
        failure: `${baseUrl}/vendas/checkout/pay?id=${orderId}`,
        pending: `${baseUrl}/vendas/checkout/pay?id=${orderId}`
      },
      auto_return: "approved",
      external_reference: orderId,
      notification_url: `${baseUrl}/api/vendas/webhook-mercadopago`
    };

    console.log(`[Mercado Pago] Criando preferência de compra para o pedido ${orderId}...`);
    const mpResponse = await fetch(mpPrefUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpAccessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(mpBody)
    });

    if (mpResponse.ok) {
      const mpData: any = await mpResponse.json();
      const redirectLink = mpData.init_point || mpData.sandbox_init_point;
      
      if (redirectLink) {
        return res.json({
          success: true,
          orderId,
          gateway: "Mercado Pago API Preference",
          redirectUrl: redirectLink
        });
      }
    } else {
      const errText = await mpResponse.text().catch(() => "");
      console.warn(`[Mercado Pago] Falha ao criar preferência de pagamento. Status ${mpResponse.status}: ${errText}. Forçando fallback.`);
    }
  } catch (error) {
    console.error("[Mercado Pago] Erro na requisição de integração com a API do Mercado Pago. Forçando fallback.", error);
  }

  // Fallback to local checkout simulator URL
  return res.json({
    success: true,
    orderId,
    gateway: "Virtual Simulator Gateway (API Fallback)",
    redirectUrl: `/vendas/checkout/pay?id=${orderId}`
  });
});

// Helper to update order status and decrement product stock securely
async function updateOrderStatusInDatabase(orderId: string, status: string, paymentId: string) {
  if (!adminDb) {
    throw new Error("Banco de dados indisponível no backend.");
  }

  const orderRef = adminDb.collection("ecom_orders").doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    console.warn(`[Webhook MercadoPago] Pedido ${orderId} não encontrado no Firestore.`);
    throw new Error(`Pedido ${orderId} não localizado.`);
  }

  const orderData = orderSnap.data();
  const currentStatus = orderData?.status || "Aguardando pagamento";
  const items = orderData?.items || [];

  console.log(`[Webhook MercadoPago] Status atual do pedido: '${currentStatus}', Novo status pretendido: '${status}'`);

  // Decrease stock if order transitions from "Aguardando pagamento" to "Pago"
  if (currentStatus === "Aguardando pagamento" && status === "Pago") {
    console.log(`[Webhook MercadoPago] Diminuindo estoque de produtos para o pedido ${orderId}...`);
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
  }

  // Update Order Status in database
  await orderRef.update({
    status: status,
    paymentId: paymentId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

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
        await updateOrderStatusInDatabase(orderId, status, paymentId);
        return res.json({ success: true, orderId, updatedStatus: status });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }
  }

  // Resolve standard paymentId and notification source
  let paymentId = payload.data?.id || payload.id || query.id;

  // Mercado Pago webhook format checking can contain resource locator URL
  if (!paymentId && payload.resource) {
    const match = String(payload.resource).match(/\/payments\/(\d+)/);
    if (match) {
      paymentId = match[1];
    }
  }
  
  if (query.topic === "payment" && query.id) {
    paymentId = query.id;
  }

  if (!paymentId) {
    return res.status(200).json({ status: "ignored", message: "Sem payment ID válido" });
  }

  const mpToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!mpToken) {
    return res.status(400).json({ error: "Faltando MERCADOPAGO_ACCESS_TOKEN para processamento real de pagamentos." });
  }

  try {
    const mpPaymentUrl = `https://api.mercadopago.com/v1/payments/${paymentId}`;
    console.log(`[Webhook MercadoPago] Consultando detalhes do pagamento ${paymentId} na API do Mercado Pago...`);
    const mpResponse = await fetch(mpPaymentUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${mpToken}`,
        "Accept": "application/json"
      }
    });

    if (mpResponse.ok) {
      const paymentData: any = await mpResponse.json();
      const orderId = paymentData.external_reference;
      const mpStatus = paymentData.status; // 'approved', 'pending', 'in_process', 'rejected', 'cancelled', etc.

      if (!orderId) {
        console.warn(`[Webhook MercadoPago] Pagamento ${paymentId} não contém external_reference (orderId). Ignorando.`);
        return res.json({ success: true, message: "Sem reference" });
      }

      let orderStatus = "Aguardando pagamento";
      if (mpStatus === "approved") {
        orderStatus = "Pago";
      } else if (["rejected", "cancelled", "refunded", "charged_back"].includes(mpStatus)) {
        orderStatus = "Cancelado";
      }

      await updateOrderStatusInDatabase(orderId, orderStatus, String(paymentId));
      return res.json({ success: true, orderId, updatedStatus: orderStatus });
    } else {
      const errorText = await mpResponse.text().catch(() => "");
      console.warn(`[Webhook MercadoPago] Erro ao consultar pagamento ${paymentId} na API. Status: ${mpResponse.status}. Retorno: ${errorText}`);
      res.status(500).json({ error: "Erro ao consultar pagamento na API do Mercado Pago." });
    }
  } catch (error: any) {
    console.error("[Webhook MercadoPago Error] Falha ao sincronizar webhook:", error);
    res.status(500).json({ error: error.message });
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
    await updateOrderStatusInDatabase(orderId, status, paymentId);
    return res.json({ success: true, orderId, updatedStatus: status });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Admin Response and Quote Emailing Endpoint
app.post("/api/vendas/quotes/respond", async (req, res) => {
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

    // Generate unique pending purchase order ID
    const orderId = "ORD-Q-" + Math.random().toString(36).substr(2, 6).toUpperCase();
    const productPrice = Number(quoteData.productPrice) || 0;
    const quantity = Number(quoteData.quantity) || 1;
    const shippingCost = Number(responseValue.shippingCost) || 0;
    const subtotal = productPrice * quantity;
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
        street: "Endereço por Confirmar",
        number: "S/N",
        neighborhood: "Bairro por Confirmar",
        complement: ""
      },
      items: [{
        productId: quoteData.productId,
        name: quoteData.productName,
        price: productPrice,
        quantity: quantity,
        images: quoteData.productImage ? [quoteData.productImage] : []
      }],
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
    res.status(500).json({ error: error.message || "Erro desconhecido ao cadastrar resposta da cotação." });
  }
});

// Endpoint de segurança para baixar cópia de segurança robusta do projeto
app.get("/api/download-zip", (req, res) => {
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

export default app;
