import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerWithEmail, loginWithGoogle } from "@/lib/auth";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
	const navigate = useNavigate();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		if (password.length < 8) {
			setError("A senha deve ter pelo menos 8 caracteres.");
			return;
		}

		if (password !== confirmPassword) {
			setError("As senhas não coincidem.");
			return;
		}

		setLoading(true);

		try {
			await registerWithEmail(name, email, password);
			navigate("/dashboard");
		} catch (submitError) {
			setError(
				submitError instanceof Error
					? submitError.message
					: "Erro ao criar conta.",
			);
		} finally {
			setLoading(false);
		}
	}

	async function handleGoogleSignup() {
		setError(null);
		setLoading(true);

		try {
			await loginWithGoogle();
			navigate("/dashboard");
		} catch (submitError) {
			setError(
				submitError instanceof Error
					? submitError.message
					: "Erro ao criar conta com Google.",
			);
		} finally {
			setLoading(false);
		}
	}

	return (
		<Card {...props}>
			<CardHeader>
				<CardTitle>Criar uma conta</CardTitle>
				<CardDescription>
					Preencha seus dados para começar a usar o FinTrack
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="name">Nome completo</FieldLabel>
							<Input
								id="name"
								type="text"
								placeholder="João Silva"
								autoComplete="name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								required
								disabled={loading}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="email">E-mail</FieldLabel>
							<Input
								id="email"
								type="email"
								placeholder="seu@email.com"
								autoComplete="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								required
								disabled={loading}
							/>
							<FieldDescription>
								Usaremos este e-mail apenas para acesso à sua conta.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="password">Senha</FieldLabel>
							<Input
								id="password"
								type="password"
								autoComplete="new-password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								required
								disabled={loading}
							/>
							<FieldDescription>
								Mínimo de 8 caracteres.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="confirm-password">
								Confirmar senha
							</FieldLabel>
							<Input
								id="confirm-password"
								type="password"
								autoComplete="new-password"
								value={confirmPassword}
								onChange={(event) => setConfirmPassword(event.target.value)}
								required
								disabled={loading}
							/>
						</Field>
						{error && (
							<Field>
								<FieldError>{error}</FieldError>
							</Field>
						)}
						<FieldGroup>
							<Field>
								<Button type="submit" disabled={loading}>
									{loading ? "Criando conta..." : "Criar conta"}
								</Button>
								<Button
									variant="outline"
									type="button"
									disabled={loading}
									onClick={handleGoogleSignup}
								>
									Criar conta com Google
								</Button>
								<FieldDescription className="px-6 text-center">
									Já tem uma conta?{" "}
									<Link to="/login" className="underline underline-offset-4">
										Entrar
									</Link>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
