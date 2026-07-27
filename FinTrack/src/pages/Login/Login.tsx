import { AuthLayout } from "@/components/auth-layout";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
	return (
		<AuthLayout title="FinTrack" subtitle="Controle suas finanças com clareza">
			<LoginForm />
		</AuthLayout>
	);
}
