import express from "express";
import logicApp from "../server/server-logic.js";

const app = express();

// Delegate all requests to the loaded logic app
app.all("*", (req, res, next) => {
  return logicApp(req, res, next);
});

export default app;
