import { IDatabaseProvider } from "./DatabaseProvider";
import { FirestoreAdminProvider } from "./FirestoreAdminProvider";
import { Logger } from "../../utils/logger";

let activeProvider: IDatabaseProvider;

export function initializeDatabase(): IDatabaseProvider {
  if (activeProvider) return activeProvider;

  Logger.info("[Database] Inicializando FirestoreAdminProvider (Firebase Admin SDK)...");
  activeProvider = new FirestoreAdminProvider();

  return activeProvider;
}

export function getDatabaseProvider(): IDatabaseProvider {
  if (!activeProvider) {
    return initializeDatabase();
  }
  return activeProvider;
}

export * from "./DatabaseProvider";
