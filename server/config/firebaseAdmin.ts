import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

// Let's declare our single shared app and firestore database references
let appInstance: admin.app.App;
let adminDb: admin.firestore.Firestore;

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

// Support overriding via standard environment variables and handle custom project fallback
const hasCustomCredentials = !!process.env.FIREBASE_SERVICE_ACCOUNT || (!!process.env.FIREBASE_PRIVATE_KEY && !!process.env.FIREBASE_CLIENT_EMAIL);

if (process.env.FIREBASE_PROJECT_ID) {
  firebaseConfig.projectId = process.env.FIREBASE_PROJECT_ID;
}
if (process.env.FIREBASE_DATABASE_ID) {
  firebaseConfig.firestoreDatabaseId = process.env.FIREBASE_DATABASE_ID;
} else if (hasCustomCredentials || process.env.NODE_ENV === "production" || !!process.env.VERCEL) {
  // If we are in production, deployed, or using custom credentials, we should connect to the "(default)" database,
  // since custom multi-databases like "ai-studio-..." are sandboxed and do not exist in custom/production projects.
  firebaseConfig.firestoreDatabaseId = "";
}

let credential = undefined;

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

export { admin, appInstance, adminDb };
