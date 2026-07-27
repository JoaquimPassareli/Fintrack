import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { resetPassword } from "@/lib/auth";
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

export function ForgotPasswordForm({
	...props
}: React.ComponentProps<typeof Card>) {
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setSuccess(null);
		setLoading(true);

		try {
			await resetPassword(email);
			setSuccess(
				"Enviamos um link de redefinição para o seu e-mail. Verifique sua caixa de entrada.",
			);
		} catch (submitError) {
			setError(
				submitError instanceof Error
					? submitError.message
					: "Erro ao enviar e-mail de recuperação.",
			);
		} finally {
			setLoading(false);
		}
	}

	return (
		<Card {...props}>
			<CardHeader>
				<CardTitle>Recuperar senha</CardTitle>
				<CardDescription>
					Digite seu e-mail e enviaremos um link para redefinir sua senha
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
							<FieldDescription>
								Se o e-mail existir, você receberá instruções para criar uma
								nova senha.
							</FieldDescription>
						</Field>
						{error && (
							<Field>
								<FieldError>{error}</FieldError>
							</Field>
						)}
						{success && (
							<Field>
								<p className="text-sm text-emerald-600 dark:text-emerald-400">
									{success}
								</p>
							</Field>
						)}
						<Field>
							<Button type="submit" disabled={loading}>
								{loading ? "Enviando..." : "Enviar link de recuperação"}
							</Button>
							<FieldDescription className="text-center">
								Lembrou a senha?{" "}
								<Link to="/login" className="underline underline-offset-4">
									Voltar ao login
								</Link>
							</FieldDescription>
						</Field>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
