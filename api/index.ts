import express from "express";

const app = express();

let logicApp: any = null;
let initError: any = null;

// Dynamically import the real server logic asynchronously
// This prevents initialization-time crashes from completely bringing down the Vercel container with a 500 error,
// allowing us to intercept and output the exact stack trace to help diagnose configuration/library mismatches.
import("./server-logic")
  .then((m) => {
    logicApp = m.default || m;
    console.log("Successfully loaded server-logic module.");
  })
  .catch((err) => {
    console.error("CRITICAL: Failed to load server-logic module:", err);
    initError = err;
  });

// Delegate all requests to the loaded logic app
app.all("*", (req, res, next) => {
  if (initError) {
    res.status(500).json({
      error: "Failed to initialize server-logic",
      message: initError.message || String(initError),
      stack: initError.stack || null
    });
    return;
  }

  if (logicApp) {
    return logicApp(req, res, next);
  }

  // If not yet loaded, wait up to 8 seconds using a non-blocking check
  let elapsed = 0;
  const interval = setInterval(() => {
    elapsed += 100;
    if (initError) {
      clearInterval(interval);
      res.status(500).json({
        error: "Failed to initialize server-logic during retry",
        message: initError.message || String(initError),
        stack: initError.stack || null
      });
      return;
    }
    if (logicApp) {
      clearInterval(interval);
      return logicApp(req, res, next);
    }
    if (elapsed >= 8000) {
      clearInterval(interval);
      if (!res.headersSent) {
        res.status(503).json({
          error: "Initialization Timeout",
          message: "The server-logic module is taking too long to load. Please reload in a few seconds."
        });
      }
    }
  }, 100);
});

export default app;
