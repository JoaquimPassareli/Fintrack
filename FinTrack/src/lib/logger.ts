// Simple in-memory logger that persists across page reloads
class Logger {
	private logs: Array<{ timestamp: string; level: string; message: string }> = [];
	private maxLogs = 100;

	log(message: string) {
		this.addLog("LOG", message);
	}

	error(message: string) {
		this.addLog("ERROR", message);
	}

	warn(message: string) {
		this.addLog("WARN", message);
	}

	debug(message: string) {
		this.addLog("DEBUG", message);
	}

	private addLog(level: string, message: string) {
		const timestamp = new Date().toISOString();
		this.logs.push({ timestamp, level, message });

		// Keep only last maxLogs entries
		if (this.logs.length > this.maxLogs) {
			this.logs.shift();
		}

		// Also log to console
		console.log(`[${timestamp}] [${level}] ${message}`);

		// Save to localStorage for persistence
		try {
			localStorage.setItem("fintrack_logs", JSON.stringify(this.logs));
		} catch (e) {
			console.error("Failed to save logs to localStorage", e);
		}
	}

	getLogs() {
		return this.logs;
	}

	getLogsAsString() {
		return this.logs
			.map((log) => `[${log.timestamp}] [${log.level}] ${log.message}`)
			.join("\n");
	}

	clear() {
		this.logs = [];
		localStorage.removeItem("fintrack_logs");
	}
}

// Create global logger instance
const logger = new Logger();

// Load logs from localStorage if they exist
try {
	const savedLogs = localStorage.getItem("fintrack_logs");
	if (savedLogs) {
		const parsed = JSON.parse(savedLogs);
		if (Array.isArray(parsed)) {
			logger["logs"] = parsed;
		}
	}
} catch (e) {
	console.error("Failed to load logs from localStorage", e);
}

export default logger;
