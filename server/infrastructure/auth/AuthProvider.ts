import { appInstance } from "../../config/firebaseAdmin";
import { getAuth } from "firebase-admin/auth";
import { Logger } from "../../utils/logger";

export async function verifyFirebaseToken(token: string): Promise<{ uid: string; email: string; name: string }> {
  const decodedToken = await getAuth(appInstance).verifyIdToken(token);
  return {
    uid: decodedToken.uid,
    email: decodedToken.email || "",
    name: decodedToken.name || decodedToken.email?.split("@")[0] || "Aluno",
  };
}

