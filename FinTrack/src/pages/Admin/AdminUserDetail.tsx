import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/lib/firebase";
import {
	collection,
	getDocs,
	doc,
	getDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Trash2, Edit2 } from "lucide-react";
import { deleteUser, updateUserInfo } from "@/lib/admin";

interface Transaction {
	id: string;
	description: string;
	amount: number;
	date: string;
	type: "income" | "expense";
	category?: string;
	paymentMethod?: string;
}

interface Boleto {
	id: string;
	name: string;
	amount: number;
	dueDate: string;
	pago: boolean;
	createdAt?: string;
}

interface UserDetail {
	uid: string;
	email?: string;
	displayName?: string;
	createdAt?: string;
	transactionCount?: number;
}

export default function AdminUserDetail() {
	const { userId } = useParams<{ userId: string }>();
	const navigate = useNavigate();
	const [user, setUser] = useState<UserDetail | null>(null);
	const [transactions, setTransactions] = useState<Transaction[]>([]);
	const [boletos, setBoletos] = useState<Boleto[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [editName, setEditName] = useState("");
	const [editEmail, setEditEmail] = useState("");
	const [isDeleting, setIsDeleting] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);

	useEffect(() => {
		const loadUserDetails = async () => {
			if (!userId) return;

			try {
				// Carregar dados do usuário
				const userDocRef = doc(db, "users", userId);
				const userDocSnap = await getDoc(userDocRef);

				if (!userDocSnap.exists()) {
					setError("Usuário não encontrado");
					setLoading(false);
					return;
				}

				const userData = userDocSnap.data();
				setUser({
					uid: userId,
					email: userData.email,
					displayName: userData.displayName,
					createdAt: userData.createdAt,
				});
				setEditName(userData.displayName || "");
				setEditEmail(userData.email || "");

				// Carregar transações do usuário
				const txRef = collection(db, "users", userId, "transactions");
				const txSnapshot = await getDocs(txRef);
				const txList: Transaction[] = [];
				txSnapshot.forEach((doc) => {
					txList.push({
						id: doc.id,
						...doc.data(),
					} as Transaction);
				});
				setTransactions(txList.sort((a, b) => {
					const dateA = new Date(a.date).getTime();
					const dateB = new Date(b.date).getTime();
					return dateB - dateA;
				}));

				// Carregar boletos do usuário
				const boletoRef = collection(db, "users", userId, "boletos");
				const boletoSnapshot = await getDocs(boletoRef);
				const boletoList: Boleto[] = [];
				boletoSnapshot.forEach((doc) => {
					boletoList.push({
						id: doc.id,
						...doc.data(),
					} as Boleto);
				});
				setBoletos(boletoList.sort((a, b) => {
					const dateA = new Date(a.dueDate).getTime();
					const dateB = new Date(b.dueDate).getTime();
					return dateB - dateA;
				}));

				setLoading(false);
			} catch (err) {
				console.error("[AdminUserDetail] Error:", err);
				setError(
					err instanceof Error
						? err.message
						: "Erro ao carregar detalhes do usuário",
				);
				setLoading(false);
			}
		};

		loadUserDetails();
	}, [userId]);

	const handleDeleteUser = async () => {
		if (!userId) return;
		setIsDeleting(true);
		try {
			await deleteUser(userId);
			navigate("/admin");
		} catch (err) {
			console.error("Erro ao deletar usuário:", err);
			setError(
				err instanceof Error
					? err.message
					: "Erro ao deletar usuário"
			);
			setIsDeleting(false);
		}
	};

	const handleEditUser = async () => {
		if (!userId) return;
		setIsUpdating(true);
		try {
			await updateUserInfo(userId, {
				displayName: editName,
				email: editEmail,
			});
			setUser((prev) =>
				prev
					? {
							...prev,
							displayName: editName,
							email: editEmail,
						}
					: null
			);
			setShowEditModal(false);
		} catch (err) {
			console.error("Erro ao atualizar usuário:", err);
			setError(
				err instanceof Error
					? err.message
					: "Erro ao atualizar usuário"
			);
		} finally {
			setIsUpdating(false);
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<p>Carregando detalhes do usuário...</p>
			</div>
		);
	}

	if (error || !user) {
		return (
			<div className="min-h-screen bg-background p-6">
				<div className="max-w-4xl mx-auto">
					<Button
						variant="outline"
						onClick={() => navigate("/admin")}
						className="mb-6"
					>
						<ArrowLeft className="size-4 mr-2" />
						Voltar
					</Button>
					<Card>
						<CardHeader>
							<CardTitle>Erro</CardTitle>
						</CardHeader>
						<CardContent>
							<p>{error || "Usuário não encontrado"}</p>
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	const totalReceitas = transactions
		.filter((t) => t.type === "income")
		.reduce((sum, t) => sum + t.amount, 0);
	const totalDespesas = transactions
		.filter((t) => t.type === "expense")
		.reduce((sum, t) => sum + t.amount, 0);
	const totalBoletos = boletos.reduce((sum, b) => sum + b.amount, 0);
	const boletosPagos = boletos.filter((b) => b.pago).length;

	return (
		<>
			<div className="min-h-screen bg-background p-6">
				<div className="max-w-6xl mx-auto">
					<Button
						variant="outline"
						onClick={() => navigate("/admin")}
						className="mb-6"
					>
						<ArrowLeft className="size-4 mr-2" />
						Voltar
					</Button>

					{/* User Info */}
					<Card className="mb-6">
						<CardHeader>
							<div className="flex justify-between items-start">
								<div>
									<CardTitle>{user.displayName || "Sem nome"}</CardTitle>
									<CardDescription>{user.email}</CardDescription>
								</div>
								<div className="flex gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => setShowEditModal(true)}
									>
										<Edit2 className="size-4 mr-2" />
										Editar
									</Button>
									<Button
										variant="destructive"
										size="sm"
										onClick={() => setShowDeleteConfirm(true)}
									>
										<Trash2 className="size-4 mr-2" />
										Deletar
									</Button>
								</div>
							</div>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<p className="text-muted-foreground">UID</p>
									<p className="font-mono text-xs">{user.uid}</p>
								</div>
								<div>
									<p className="text-muted-foreground">Data de Criação</p>
									<p>{user.createdAt}</p>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Stats */}
					<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium">
									Transações
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-2xl font-bold">{transactions.length}</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium">Receitas</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-2xl font-bold text-green-600">
									R$ {totalReceitas.toFixed(2)}
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium">Despesas</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-2xl font-bold text-red-600">
									R$ {totalDespesas.toFixed(2)}
								</p>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium">Boletos</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-2xl font-bold">{boletos.length}</p>
								<p className="text-xs text-muted-foreground">
									{boletosPagos} pagos
								</p>
							</CardContent>
						</Card>
					</div>

					{/* Transactions */}
					<Card className="mb-6">
						<CardHeader>
							<CardTitle>Transações</CardTitle>
							<CardDescription>
								{transactions.length} transações encontradas
							</CardDescription>
						</CardHeader>
						<CardContent>
							{transactions.length === 0 ? (
								<p className="text-muted-foreground">
									Nenhuma transação encontrada
								</p>
							) : (
								<div className="space-y-2 max-h-96 overflow-y-auto">
									{transactions.map((tx) => (
										<div
											key={tx.id}
											className="flex justify-between items-center p-3 border rounded-lg"
										>
											<div>
												<p className="font-medium">{tx.description}</p>
												<p className="text-xs text-muted-foreground">
													{tx.date} • {tx.category}
												</p>
											</div>
											<p
												className={`font-bold ${
													tx.type === "income"
														? "text-green-600"
														: "text-red-600"
												}`}
											>
												{tx.type === "income" ? "+" : "-"} R${" "}
												{tx.amount.toFixed(2)}
											</p>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>

					{/* Boletos */}
					<Card>
						<CardHeader>
							<CardTitle>Boletos</CardTitle>
							<CardDescription>
								R$ {totalBoletos.toFixed(2)} em boletos
							</CardDescription>
						</CardHeader>
						<CardContent>
							{boletos.length === 0 ? (
								<p className="text-muted-foreground">
									Nenhum boleto encontrado
								</p>
							) : (
								<div className="space-y-2 max-h-96 overflow-y-auto">
									{boletos.map((boleto) => (
										<div
											key={boleto.id}
											className={`flex justify-between items-center p-3 border rounded-lg ${
												boleto.pago
													? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
													: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800"
											}`}
										>
											<div>
												<p className="font-medium">{boleto.name}</p>
												<p className="text-xs text-muted-foreground">
													Vence em {boleto.dueDate} •{" "}
													{boleto.pago ? "✓ Pago" : "Pendente"}
												</p>
											</div>
											<p className="font-bold">
												R$ {boleto.amount.toFixed(2)}
											</p>
										</div>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</div>

			{/* Delete Confirmation Modal */}
			{showDeleteConfirm && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<Card className="max-w-sm">
						<CardHeader>
							<CardTitle>Deletar Usuário?</CardTitle>
							<CardDescription>
								Esta ação não pode ser desfeita. Todas as transações e boletos
								também serão deletados.
							</CardDescription>
						</CardHeader>
						<CardContent className="flex gap-2 justify-end">
							<Button
								variant="outline"
								onClick={() => setShowDeleteConfirm(false)}
								disabled={isDeleting}
							>
								Cancelar
							</Button>
							<Button
								variant="destructive"
								onClick={handleDeleteUser}
								disabled={isDeleting}
							>
								{isDeleting ? "Deletando..." : "Deletar"}
							</Button>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Edit Modal */}
			{showEditModal && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<Card className="max-w-md w-full mx-4">
						<CardHeader>
							<CardTitle>Editar Usuário</CardTitle>
							<CardDescription>
								Atualize as informações do usuário
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<Label htmlFor="edit-name">Nome</Label>
								<Input
									id="edit-name"
									value={editName}
									onChange={(e) => setEditName(e.target.value)}
									placeholder="Nome do usuário"
									className="mt-2"
								/>
							</div>
							<div>
								<Label htmlFor="edit-email">Email</Label>
								<Input
									id="edit-email"
									type="email"
									value={editEmail}
									onChange={(e) => setEditEmail(e.target.value)}
									placeholder="Email do usuário"
									className="mt-2"
								/>
							</div>
							<div className="flex gap-2 justify-end pt-4">
								<Button
									variant="outline"
									onClick={() => setShowEditModal(false)}
									disabled={isUpdating}
								>
									Cancelar
								</Button>
								<Button onClick={handleEditUser} disabled={isUpdating}>
									{isUpdating ? "Salvando..." : "Salvar"}
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			)}
		</>
	);
}
