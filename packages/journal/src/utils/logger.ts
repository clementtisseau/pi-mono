export interface Logger {
	debug(message: string, details?: Record<string, unknown>): void;
	warn(message: string, details?: Record<string, unknown>): void;
	error(message: string, details?: Record<string, unknown>): void;
}

function log(level: string, message: string, details?: Record<string, unknown>): void {
	if (!process.env.PI_JOURNAL_DEBUG && level === "debug") return;
	const suffix = details ? ` ${JSON.stringify(details)}` : "";
	console.error(`[pi-journal:${level}] ${message}${suffix}`);
}

export const logger: Logger = {
	debug(message, details) {
		log("debug", message, details);
	},
	warn(message, details) {
		log("warn", message, details);
	},
	error(message, details) {
		log("error", message, details);
	},
};
