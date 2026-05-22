import express from "express";
import path from "path";
import app from "./api/index";

const PORT = 3000;

// Enable local serving & Vite configurations when running on our VM or container
// Note: on Vercel, process.env.VERCEL is "1" and Vercel will completely ignore server.ts launcher,
// proxying routes directly to the serverless function in api/index.ts.
const isVercel = process.env.VERCEL === "1" || !!process.env.NOW_REGION;

if (!isVercel) {
  const initServer = async () => {
    if (process.env.NODE_ENV !== "production") {
      // Hide string "vite" to bypass Vercel static tracing
      const packageToImport = ["v", "i", "t", "e"].join("");
      const { createServer: createViteServer } = await import(packageToImport);
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
  };

  initServer().catch(err => {
    console.error("Erro ao inicializar middleware do servidor local:", err);
  });
}

export default app;
