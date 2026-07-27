import { AuthLayout } from "@/components/auth-layout";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export default function ForgotPasswordPage() {
	return (
		<AuthLayout title="FinTrack" subtitle="Recupere o acesso à sua conta">
			<ForgotPasswordForm />
		</AuthLayout>
	);
}
