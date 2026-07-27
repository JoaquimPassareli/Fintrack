import { AuthLayout } from "@/components/auth-layout";
import { SignupForm } from "@/components/signup-form";

export default function RegisterPage() {
	return (
		<AuthLayout title="FinTrack" subtitle="Crie sua conta gratuitamente">
			<SignupForm />
		</AuthLayout>
	);
}
