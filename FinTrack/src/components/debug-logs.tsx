import { useEffect, useState } from "react";
import logger from "@/lib/logger";
import { Button } from "@/components/ui/button";

export function DebugLogs() {
	const [logs, setLogs] = useState<string>("");
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		const interval = setInterval(() => {
			setLogs(logger.getLogsAsString());
		}, 500);

		return () => clearInterval(interval);
	}, []);

	if (!isOpen) {
		return (
			<button
				onClick={() => setIsOpen(true)}
				className="fixed bottom-4 right-4 bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 z-50"
			>
				Debug Logs
			</button>
		);
	}

	return (
		<div className="fixed bottom-4 right-4 bg-black text-green-400 p-4 rounded max-w-md max-h-64 overflow-auto font-mono text-xs z-50 border-2 border-green-400">
			<div className="flex justify-between items-center mb-2">
				<span className="font-bold">Debug Logs</span>
				<button
					onClick={() => setIsOpen(false)}
					className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-white"
				>
					X
				</button>
			</div>
			<pre className="whitespace-pre-wrap break-words">{logs || "Waiting for logs..."}</pre>
			<Button
				size="sm"
				variant="outline"
				onClick={() => logger.clear()}
				className="mt-2 w-full"
			>
				Clear Logs
			</Button>
		</div>
	);
}
