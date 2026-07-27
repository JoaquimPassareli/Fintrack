import {
	createUserWithEmailAndPassword,
	sendPasswordResetEmail,
	signInWithEmailAndPassword,
	signInWithPopup,
	updateProfile,
	type UserCredential,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

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
		return await signInWithEmailAndPassword(auth, email, password);
	} catch (error) {
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
		return credential;
	} catch (error) {
		throw new Error(getAuthErrorMessage(error));
	}
}

export async function loginWithGoogle(): Promise<UserCredential> {
	try {
		return await signInWithPopup(auth, googleProvider);
	} catch (error) {
		throw new Error(getAuthErrorMessage(error));
	}
}

export async function resetPassword(email: string): Promise<void> {
	try {
		await sendPasswordResetEmail(auth, email);
	} catch (error) {
		throw new Error(getAuthErrorMessage(error));
	}
}
