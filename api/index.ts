import express from "express";
import logicApp from "../server/server-logic";

const app = express();

app.all("*", (req, res, next) => {
  // Resiliently resolve ESM default export or CJS export
  const resolvedApp = (logicApp as any).default || logicApp;
  return resolvedApp(req, res, next);
});

export default app;

