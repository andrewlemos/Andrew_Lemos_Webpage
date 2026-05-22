import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { MailerSend, EmailParams, Sender, Recipient } from "mailersend";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Triggering GitHub sync after secret update
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const mailersend = new MailerSend({
    apiKey: process.env.MAILERSEND_API_KEY || "mlsn.088bce1b07dd2c743107ce5f55f73d492ca96cad89ed46bba24fd8773b67856b",
  });

  // API Route to send the manual
  app.post("/api/send-manual", async (req, res) => {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: "Email and name are required" });
    }

    try {
      const sentFrom = new Sender("MS_N5X99D@trial-351bpgw53p84zqx8.mlsender.net", "Andrew Lemos Art"); // Note: Trial domain from MailerSend usually looks like this
      const recipients = [new Recipient(email, name)];

      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setReplyTo(sentFrom)
        .setSubject("Seu Manual de Entalhe em Madeira chegou! 🎨")
        .setHtml(`
          <div style="font-family: serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; rounded: 20px;">
            <h1 style="color: #6d4c41;">Olá, ${name}!</h1>
            <p style="font-size: 16px; line-height: 1.6;">
              É um prazer compartilhar com você o meu <b>Manual de Introdução ao Entalhe em Madeira</b>.
            </p>
            <p style="font-size: 16px; line-height: 1.6;">
              Este guia foi preparado para ajudar você a dar os primeiros passos nesta arte milenar que tanto amo.
            </p>
            <div style="text-align: center; margin: 40px 0;">
              <a href="https://ais-dev-nszj23vldt2t4ag65mbgpx-81336736813.us-east1.run.app/arquivos/Manual%20de%20Instru%C3%A7%C3%A3o%20%E2%80%93%20Introdu%C3%A7%C3%A3o%20ao%20Entalhe%20em%20Madeira-1.pdf" 
                 style="background-color: #6d4c41; color: white; padding: 15px 30px; text-decoration: none; border-radius: 50px; font-weight: bold;">
                BAIXAR MEU MANUAL AGORA
              </a>
            </div>
            <p style="font-size: 14px; color: #666;">
              Se tiver qualquer dúvida sobre as técnicas ou sobre minhas aulas presenciais, sinta-se à vontade para responder este e-mail.
            </p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="text-align: center; font-style: italic; color: #8d6e63;">
              "A arte não reproduz o visível, ela torna visível."<br>
              <b>Andrew Lemos</b>
            </p>
          </div>
        `)
        .setText(`Olá ${name}, seu manual de entalhe chegou! Baixe aqui: https://ais-dev-nszj23vldt2t4ag65mbgpx-81336736813.us-east1.run.app/arquivos/Manual%20de%20Instru%C3%A7%C3%A3o%20%E2%80%93%20Introdu%C3%A7%C3%A3o%20ao%20Entalhe%20em%20Madeira-1.pdf`);

      await mailersend.email.send(emailParams);
      res.json({ success: true });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // API Route to handle contact form submissions securely via MailerSend
  app.post("/api/send-contact", async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Nome, e-mail e mensagem são campos obrigatórios." });
    }

    try {
      const sentFrom = new Sender("MS_N5X99D@trial-351bpgw53p84zqx8.mlsender.net", "Portfólio Andrew Lemos");
      
      // Enviando apenas para o e-mail verificado do proprietário da conta MailerSend
      const recipients = [
        new Recipient("andrewfmlemos@gmail.com", "Andrew Lemos")
      ];

      const emailParams = new EmailParams()
        .setFrom(sentFrom)
        .setTo(recipients)
        .setReplyTo(sentFrom)
        .setSubject(`Mensagem de Contato: ${subject}`)
        .setHtml(`
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
        `)
        .setText(`Nova Mensagem do Portfólio!\n\nNome: ${name}\nE-mail: ${email}\nAssunto: ${subject}\n\nMensagem:\n${message}\n\nResponder para: ${email}`);

      await mailersend.email.send(emailParams);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error sending contact email via MailerSend:", error);
      res.status(500).json({ error: error?.message || "Ocorreu um erro no servidor ao enviar a mensagem." });
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
