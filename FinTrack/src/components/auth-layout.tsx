import type { ReactNode } from "react";

type AuthLayoutProps = {
	children: ReactNode;
	title?: string;
	subtitle?: string;
};

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
	return (
		<div className="flex min-h-svh w-full items-center justify-center bg-zinc-100 p-6 md:p-10 dark:bg-zinc-950">
			<div className="w-full max-w-sm space-y-6">
				{(title || subtitle) && (
					<div className="space-y- text-center">
						{title && (
							<h1 className="text-7xl font-semibold tracking-tight">{title}</h1>
						)}
						{subtitle && (
							<p className="text-m text-muted-foreground">{subtitle}</p>
						)}
					</div>
				)}
				{children}
			</div>
		</div>
	);
}
