import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { loginWithEmail, loginWithGoogle } from "@/lib/auth";
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

export function LoginForm({
	className,
	...props
}: React.ComponentProps<"div">) {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setLoading(true);

		try {
			await loginWithEmail(email, password);
			navigate("/dashboard");
		} catch (submitError) {
			setError(
				submitError instanceof Error
					? submitError.message
					: "Erro ao fazer login.",
			);
		} finally {
			setLoading(false);
		}
	}

	async function handleGoogleLogin() {
		setError(null);
		setLoading(true);

		try {
			await loginWithGoogle();
			navigate("/dashboard");
		} catch (submitError) {
			setError(
				submitError instanceof Error
					? submitError.message
					: "Erro ao fazer login com Google.",
			);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle>Entrar na sua conta</CardTitle>
					<CardDescription>
						Digite seu e-mail abaixo para acessar o FinTrack
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
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
							</Field>
							<Field>
								<div className="flex items-center">
									<FieldLabel htmlFor="password">Senha</FieldLabel>
									<Link
										to="/esqueci-senha"
										className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
									>
										Esqueceu a senha?
									</Link>
								</div>
								<Input
									id="password"
									type="password"
									autoComplete="current-password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									required
									disabled={loading}
								/>
							</Field>
							{error && (
								<Field>
									<FieldError>{error}</FieldError>
								</Field>
							)}
							<Field>
								<Button type="submit" disabled={loading}>
									{loading ? "Entrando..." : "Entrar"}
								</Button>
								<Button
									variant="outline"
									type="button"
									disabled={loading}
									onClick={handleGoogleLogin}
								>
									Entrar com Google
								</Button>
								<FieldDescription className="text-center">
									Não tem uma conta?{" "}
									<Link to="/registro" className="underline underline-offset-4">
										Criar conta
									</Link>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
