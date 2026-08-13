import {
	createUserWithEmailAndPassword,
	getRedirectResult,
	sendPasswordResetEmail,
	signInWithEmailAndPassword,
	signInWithPopup,
	signInWithRedirect,
	updateProfile,
	type UserCredential,
} from "firebase/auth";
import { auth, googleProvider, db } from "@/lib/firebase";
import { doc, setDoc, updateDoc, getDoc } from "firebase/firestore";
import logger from "@/lib/logger";

// Check if Tauri is available
const isTauriAvailable = () => {
	try {
		// @ts-ignore
		return typeof window !== "undefined" && window.__TAURI__ !== undefined;
	} catch {
		return false;
	}
};

// Salvar dados do usuário no Firestore
async function saveUserToFirestore(uid: string, email: string, displayName: string = ""): Promise<void> {
	try {
		const debugInfo = { uid, email, displayName };
		logger.log(`[saveUserToFirestore] Attempting to save user: ${JSON.stringify(debugInfo)}`);
		const userRef = doc(db, "users", uid);
		const userSnap = await getDoc(userRef);

		const now = new Date().toISOString();

		if (userSnap.exists()) {
			// Atualizar se já existe
			logger.log("[saveUserToFirestore] User exists, updating...");
			await updateDoc(userRef, {
				lastSignIn: now,
			});
			logger.log(`[saveUserToFirestore] Updated existing user: ${email}`);
		} else {
			// Criar novo documento
			logger.log("[saveUserToFirestore] User doesn't exist, creating...");
			await setDoc(userRef, {
				uid,
				email: email.toLowerCase(),
				displayName: displayName || email.split("@")[0],
				createdAt: now,
				lastSignIn: now,
			});
			logger.log(`[saveUserToFirestore] Created new user: ${email}`);
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.error(`[saveUserToFirestore] Error: ${errorMsg}`);
		// Não lançar erro, apenas logar
	}
}

function getAuthErrorMessage(error: unknown): string {
	const code =
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		typeof error.code === "string"
			? error.code
			: "";

	switch (code) {
		case "auth/invalid-email":
			return "E-mail inválido.";
		case "auth/user-disabled":
			return "Esta conta foi desativada.";
		case "auth/user-not-found":
		case "auth/wrong-password":
		case "auth/invalid-credential":
			return "E-mail ou senha incorretos.";
		case "auth/email-already-in-use":
			return "Este e-mail já está em uso.";
		case "auth/weak-password":
			return "A senha deve ter pelo menos 6 caracteres.";
		case "auth/too-many-requests":
			return "Muitas tentativas. Tente novamente mais tarde.";
		case "auth/popup-closed-by-user":
			return "Login com Google cancelado.";
		default:
			return "Não foi possível concluir a operação. Tente novamente.";
	}
}

export async function loginWithEmail(
	email: string,
	password: string,
): Promise<UserCredential> {
	try {
		logger.log("[loginWithEmail] Starting login...");
		const credential = await signInWithEmailAndPassword(auth, email, password);
		logger.log("[loginWithEmail] Login successful, saving to Firestore...");
		
		// Salvar/atualizar no Firestore
		await saveUserToFirestore(credential.user.uid, email, credential.user.displayName || "");
		logger.log("[loginWithEmail] User saved to Firestore");
		
		return credential;
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.error(`[loginWithEmail] Error: ${errorMsg}`);
		throw new Error(getAuthErrorMessage(error));
	}
}

export async function registerWithEmail(
	name: string,
	email: string,
	password: string,
): Promise<UserCredential> {
	try {
		const credential = await createUserWithEmailAndPassword(
			auth,
			email,
			password,
		);
		await updateProfile(credential.user, { displayName: name });
		
		// Salvar no Firestore
		await saveUserToFirestore(credential.user.uid, email, name);
		
		return credential;
	} catch (error) {
		throw new Error(getAuthErrorMessage(error));
	}
}

export async function loginWithGoogle(): Promise<UserCredential> {
	try {
		logger.log("[loginWithGoogle] Starting Google login...");
		logger.log(`[loginWithGoogle] Tauri available: ${isTauriAvailable()}`);
		
		if (isTauriAvailable()) {
			// In Tauri, use redirect approach
			logger.log("[loginWithGoogle] Using Tauri redirect approach...");
			// Initiate redirect - this will redirect to Firebase auth
			await signInWithRedirect(auth, googleProvider);
			// Code won't reach here as page will redirect
			return {} as UserCredential;
		} else {
			// In web, try popup first
			try {
				logger.log("[loginWithGoogle] Trying popup...");
				const result = await signInWithPopup(auth, googleProvider);
				logger.log(`[loginWithGoogle] Popup success! User: ${result.user.email}`);
				
				// Salvar no Firestore
				await saveUserToFirestore(
					result.user.uid,
					result.user.email || "",
					result.user.displayName || ""
				);
				
				return result;
			} catch (popupError) {
				const popupErrorMsg = popupError instanceof Error ? popupError.message : String(popupError);
				logger.log(`[loginWithGoogle] Popup failed: ${popupErrorMsg}`);
				
				// Fallback to redirect if popup blocked
				if (popupErrorMsg.includes("popup-blocked")) {
					logger.log("[loginWithGoogle] Falling back to redirect...");
					await signInWithRedirect(auth, googleProvider);
					return {} as UserCredential;
				}
				
				throw popupError;
			}
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.error(`[loginWithGoogle] Error: ${errorMsg}`);
		throw new Error(getAuthErrorMessage(error));
	}
}

export async function getGoogleRedirectResult(): Promise<UserCredential | null> {
	try {
		logger.log("[getGoogleRedirectResult] Checking for redirect result...");
		const result = await getRedirectResult(auth);
		if (result) {
			logger.log(`[getGoogleRedirectResult] Found redirect result: ${result.user.email}`);
			
			// Salvar no Firestore
			await saveUserToFirestore(
				result.user.uid,
				result.user.email || "",
				result.user.displayName || ""
			);
		} else {
			logger.debug("[getGoogleRedirectResult] No redirect result found");
		}
		return result;
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.debug(`[getGoogleRedirectResult] No redirect or error: ${errorMsg}`);
		return null;
	}
}

export async function resetPassword(email: string): Promise<void> {
	try {
		await sendPasswordResetEmail(auth, email);
	} catch (error) {
		throw new Error(getAuthErrorMessage(error));
	}
}
