import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addAdminEmail } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";

export default function AdminSetup() {
	const navigate = useNavigate();
	const [adminEmail, setAdminEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	async function handleSetAdmin() {
		if (!adminEmail.trim()) {
			setError("Digite um email");
			return;
		}

		if (!adminEmail.includes("@")) {
			setError("Email inválido");
			return;
		}

		try {
			addAdminEmail(adminEmail);
			setSuccess(true);
			console.log(`[AdminSetup] Admin configurado: ${adminEmail}`);
			console.log("[AdminSetup] Você pode fazer login com este email e acessar /admin");
			
			setTimeout(() => {
				navigate("/login");
			}, 2000);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Erro ao configurar admin");
		}
	}

	return (
		<div className="flex items-center justify-center min-h-screen bg-background p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Configuração de Admin</CardTitle>
					<CardDescription>
						Configure o email do administrador da aplicação
					</CardDescription>
				</CardHeader>
				<CardContent>
					{success ? (
						<div className="text-center">
							<p className="text-green-600 font-medium mb-4">
								✓ Admin configurado com sucesso!
							</p>
							<p className="text-sm text-muted-foreground mb-4">
								Faça login com o email {adminEmail} para acessar o painel de admin
							</p>
							<p className="text-xs text-muted-foreground">
								Redirecionando para login...
							</p>
						</div>
					) : (
						<form
							onSubmit={(e) => {
								e.preventDefault();
								handleSetAdmin();
							}}
						>
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="admin-email">Email do Admin</FieldLabel>
									<Input
										id="admin-email"
										type="email"
										placeholder="admin@example.com"
										value={adminEmail}
										onChange={(e) => {
											setAdminEmail(e.target.value);
											setError(null);
										}}
										required
									/>
									<FieldDescription>
										Este email será o administrador da aplicação
									</FieldDescription>
								</Field>

								{error && (
									<Field>
										<FieldError>{error}</FieldError>
									</Field>
								)}

								<Field>
									<Button
										type="submit"
										className="w-full"
										onClick={handleSetAdmin}
									>
										Configurar Admin
									</Button>
									<Button
										type="button"
										variant="outline"
										className="w-full mt-2"
										onClick={() => navigate("/login")}
									>
										Voltar ao Login
									</Button>
								</Field>
							</FieldGroup>
						</form>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
