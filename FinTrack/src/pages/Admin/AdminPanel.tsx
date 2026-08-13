import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "@/lib/firebase";
import { isUserAdmin } from "@/lib/admin";
import { collection, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

interface UserData {
	uid: string;
	email?: string;
	displayName?: string;
	createdAt?: string;
	lastSignIn?: string;
	transactionCount?: number;
}

export default function AdminPanel() {
	const navigate = useNavigate();
	const [users, setUsers] = useState<UserData[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const checkAdminAndLoadUsers = async () => {
			try {
				// Verificar se é admin
				const adminStatus = await isUserAdmin();
				console.log("[AdminPanel] Admin status:", adminStatus);
				console.log("[AdminPanel] Current user email:", auth.currentUser?.email);
				
				if (!adminStatus) {
					setError("Acesso negado. Você não é administrador.");
					setTimeout(() => navigate("/dashboard"), 2000);
					return;
				}

				// Verificar se existem dados em Firestore na coleção users
				console.log("[AdminPanel] Checking Firestore for user documents...");
				const usersRef = collection(db, "users");
				const querySnapshot = await getDocs(usersRef);
				console.log("[AdminPanel] Firestore users found:", querySnapshot.docs.length);

				const usersList: UserData[] = [];
				
				// Se houver usuários no Firestore, usá-los
				if (querySnapshot.docs.length > 0) {
					console.log("[AdminPanel] Loading users from Firestore...");
					for (const doc of querySnapshot.docs) {
						const data = doc.data();
						usersList.push({
							uid: doc.id,
							email: data.email || "N/A",
							displayName: data.displayName || "N/A",
							createdAt: data.createdAt || "N/A",
							lastSignIn: data.lastSignIn || "N/A",
							transactionCount: data.transactionCount || 0,
						});
					}
				} else {
					// Se não houver usuários no Firestore, mostrar mensagem
					console.log("[AdminPanel] No users found in Firestore");
					console.log("[AdminPanel] Users are stored in Firebase Authentication, not in Firestore");
					setError(
						"Usuários não encontrados no banco de dados. Os usuários precisam fazer login para serem salvos no Firestore."
					);
					setLoading(false);
					return;
				}

				console.log("[AdminPanel] Users found:", usersList.length);
				setUsers(usersList);
			} catch (err) {
				console.error("[AdminPanel] Error:", err);
				console.error("[AdminPanel] Error details:", err instanceof Error ? err.message : err);
				setError(
					err instanceof Error
						? err.message
						: "Erro ao carregar dados de admin",
				);
			} finally {
				setLoading(false);
			}
		};

		checkAdminAndLoadUsers();
	}, [navigate]);

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<p>Carregando painel de admin...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<Card className="max-w-md">
					<CardHeader>
						<CardTitle>Erro</CardTitle>
					</CardHeader>
					<CardContent>
						<p>{error}</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background p-6">
			<div className="max-w-7xl mx-auto">
				<div className="mb-8">
					<h1 className="text-3xl font-bold">Painel de Admin</h1>
					<p className="text-muted-foreground mt-2">
						Total de usuários: {users.length}
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Usuários Cadastrados</CardTitle>
						<CardDescription>
							Lista de todos os usuários no sistema
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							{users.length === 0 ? (
								<p className="text-muted-foreground">Nenhum usuário encontrado.</p>
							) : (
								users.map((user) => (
									<Card key={user.uid} className="p-4 border">
										<div className="flex justify-between items-start">
											<div className="flex-1">
												<p className="font-medium">{user.displayName}</p>
												<p className="text-sm text-muted-foreground font-mono">
													{user.email}
												</p>
												<div className="grid grid-cols-2 gap-2 mt-2 text-sm">
													<div>
														<p className="text-xs text-muted-foreground">
															Data de Criação
														</p>
														<p>{user.createdAt}</p>
													</div>
													<div>
														<p className="text-xs text-muted-foreground">
															Transações
														</p>
														<p>{user.transactionCount}</p>
													</div>
												</div>
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={() => navigate(`/admin/user/${user.uid}`)}
											>
												Detalhes
											</Button>
										</div>
									</Card>
								))
							)}
						</div>
					</CardContent>
				</Card>

				<div className="mt-6">
					<Button onClick={() => navigate("/dashboard")} variant="outline">
						Voltar ao Dashboard
					</Button>
				</div>
			</div>
		</div>
	);
}
