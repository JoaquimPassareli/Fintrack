import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";

// Lista de emails que são admins
const ADMIN_EMAILS = new Set<string>();

// Função para verificar se email é admin
export function isAdminEmail(email: string): boolean {
	return ADMIN_EMAILS.has(email.toLowerCase());
}

// Função para verificar se usuário atual é admin
export async function isUserAdmin(): Promise<boolean> {
	const currentUser = auth.currentUser;
	if (!currentUser) return false;

	const email = currentUser.email || "";
	// Verificar diretamente contra o email hardcoded
	return email.toLowerCase() === "joaquim@admin.fintrack";
}

// Adicionar email como admin
export function addAdminEmail(email: string) {
	ADMIN_EMAILS.add(email.toLowerCase());
	console.log(`[Admin] Email adicionado como admin: ${email}`);
	console.log(`[Admin] Admins atuais:`, Array.from(ADMIN_EMAILS));
}

// Remover email como admin
export function removeAdminEmail(email: string) {
	ADMIN_EMAILS.delete(email.toLowerCase());
	console.log(`[Admin] Email removido como admin: ${email}`);
}

// Ver todos os admins
export function getAdminEmails() {
	return Array.from(ADMIN_EMAILS);
}

// Inicializar com um admin padrão
export function initializeAdmin(adminEmail: string) {
	addAdminEmail(adminEmail);
}

// Salvar admin no Firestore para persistência
export async function saveAdminStatus(uid: string, email: string, isAdmin: boolean) {
	try {
		const adminRef = doc(db, "admins", uid);
		await setDoc(adminRef, {
			email: email.toLowerCase(),
			isAdmin: isAdmin,
			addedAt: new Date().toISOString(),
		});

		if (isAdmin) {
			addAdminEmail(email);
		} else {
			removeAdminEmail(email);
		}

		console.log(`[Admin] Status salvo no Firestore: ${email} - ${isAdmin}`);
	} catch (error) {
		console.error("[Admin] Erro ao salvar admin status:", error);
	}
}

// Carregar admins do Firestore na inicialização
export async function loadAdminsFromFirestore() {
	try {
		const adminRef = doc(db, "admins", "list");
		const docSnap = await getDoc(adminRef);

		if (docSnap.exists()) {
			const data = docSnap.data();
			if (data.emails && Array.isArray(data.emails)) {
				data.emails.forEach((email: string) => {
					ADMIN_EMAILS.add(email.toLowerCase());
				});
				console.log("[Admin] Admins carregados do Firestore:", Array.from(ADMIN_EMAILS));
			}
		}
	} catch (error) {
		console.error("[Admin] Erro ao carregar admins:", error);
	}
}

// Deletar usuário (deleta documento principal e todas as subcollections)
export async function deleteUser(userId: string) {
	try {
		const userRef = doc(db, "users", userId);
		
		// Deletar todas as transações
		const txRef = collection(db, "users", userId, "transactions");
		const txSnapshot = await getDocs(txRef);
		for (const doc of txSnapshot.docs) {
			await deleteDoc(doc.ref);
		}

		// Deletar todos os boletos
		const boletoRef = collection(db, "users", userId, "boletos");
		const boletoSnapshot = await getDocs(boletoRef);
		for (const doc of boletoSnapshot.docs) {
			await deleteDoc(doc.ref);
		}

		// Deletar documento do usuário
		await deleteDoc(userRef);
		console.log(`[Admin] Usuário deletado: ${userId}`);
	} catch (error) {
		console.error("[Admin] Erro ao deletar usuário:", error);
		throw error;
	}
}

// Editar informações do usuário
export async function updateUserInfo(userId: string, data: { displayName?: string; email?: string }) {
	try {
		const userRef = doc(db, "users", userId);
		await updateDoc(userRef, {
			...(data.displayName !== undefined && { displayName: data.displayName }),
			...(data.email !== undefined && { email: data.email }),
			updatedAt: new Date().toISOString(),
		});
		console.log(`[Admin] Usuário atualizado: ${userId}`, data);
	} catch (error) {
		console.error("[Admin] Erro ao atualizar usuário:", error);
		throw error;
	}
}