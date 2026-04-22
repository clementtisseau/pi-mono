import type {
	BeforeAgentStartEvent,
	SessionShutdownEvent,
	SessionStartEvent,
	ToolCallEvent,
	ToolResultEvent,
} from "@mariozechner/pi-coding-agent";
import type { JournalEvent, JournalEventStatus, NormalizedEvent, ValidationRecord } from "../types.js";
import { createId } from "../utils/ids.js";

export type CapturablePiEvent =
	| SessionStartEvent
	| SessionShutdownEvent
	| BeforeAgentStartEvent
	| ToolCallEvent
	| ToolResultEvent;

export function normalizeEvent(sessionId: string, event: CapturablePiEvent): NormalizedEvent {
	const base: JournalEvent = {
		sessionId,
		kind: mapKind(event),
		timestamp: Date.now(),
		payload: buildPayload(event),
	};

	const validation = extractValidation(event);
	const filePaths = extractFilePaths(event);
	const status = mapStatus(event);
	const toolName = "toolName" in event ? event.toolName : undefined;

	return {
		id: createId("evt"),
		...base,
		status,
		summary: buildSummary(event, status),
		isMeaningful: isMeaningfulEvent(event, validation, filePaths),
		isMutating: isMutatingEvent(event),
		toolName,
		filePaths,
		validation,
	};
}

export function isMutatingEvent(event: ToolCallEvent | ToolResultEvent | CapturablePiEvent): boolean {
	if (!("toolName" in event)) return false;
	if (event.toolName === "edit" || event.toolName === "write") return true;
	if (event.toolName !== "bash") return false;
	const command = typeof event.input.command === "string" ? event.input.command : "";
	return isLikelyMutatingCommand(command);
}

export function isLikelyMutatingCommand(command: string): boolean {
	const normalized = command.trim().toLowerCase();
	if (!normalized) return false;
	const nonMutatingPrefixes = [
		"git status",
		"git diff",
		"git log",
		"git show",
		"git branch --show-current",
		"git rev-parse",
		"ls",
		"pwd",
		"find ",
		"grep ",
		"rg ",
		"cat ",
		"head ",
		"tail ",
		"wc ",
		"echo ",
		"npm run check",
		"npm exec biome check",
		"npx vitest",
		"npm test",
		"pnpm test",
		"yarn test",
		"tsc",
	];
	return !nonMutatingPrefixes.some((prefix) => normalized.startsWith(prefix));
}

function mapKind(event: CapturablePiEvent): NormalizedEvent["kind"] {
	switch (event.type) {
		case "session_start":
			return "session_start";
		case "session_shutdown":
			return "session_shutdown";
		case "before_agent_start":
			return "agent_prompt";
		case "tool_call":
			return "tool_call";
		case "tool_result":
			return "tool_result";
	}
}

function mapStatus(event: CapturablePiEvent): JournalEventStatus {
	if (event.type === "tool_result") return event.isError ? "error" : "success";
	return "info";
}

function buildSummary(event: CapturablePiEvent, status: JournalEventStatus): string {
	switch (event.type) {
		case "session_start":
			return `Session started (${event.reason})`;
		case "session_shutdown":
			return "Session shut down";
		case "before_agent_start":
			return `Prompt: ${event.prompt.trim().slice(0, 120)}`;
		case "tool_call":
			return `Tool call: ${event.toolName}`;
		case "tool_result":
			return `Tool result: ${event.toolName} (${status})`;
	}
}

function buildPayload(event: CapturablePiEvent): Record<string, unknown> {
	switch (event.type) {
		case "session_start":
			return { reason: event.reason, previousSessionFile: event.previousSessionFile };
		case "session_shutdown":
			return {};
		case "before_agent_start":
			return { prompt: event.prompt, imageCount: event.images?.length ?? 0 };
		case "tool_call":
			return { toolCallId: event.toolCallId, toolName: event.toolName, input: event.input };
		case "tool_result":
			return {
				toolCallId: event.toolCallId,
				toolName: event.toolName,
				input: event.input,
				isError: event.isError,
				details: event.details,
			};
		default:
			return {};
	}
}

function extractFilePaths(event: CapturablePiEvent): string[] {
	if (!("toolName" in event)) return [];
	if (event.toolName === "read" || event.toolName === "write") {
		return typeof event.input.path === "string" ? [event.input.path] : [];
	}
	if (event.toolName === "edit") {
		return typeof event.input.path === "string" ? [event.input.path] : [];
	}
	if (event.toolName === "bash") {
		return [];
	}
	return [];
}

function extractValidation(event: CapturablePiEvent): ValidationRecord | undefined {
	if (event.type !== "tool_result" || event.toolName !== "bash") return undefined;
	const command = typeof event.input.command === "string" ? event.input.command.trim() : "";
	if (!command) return undefined;
	const kind = classifyValidation(command);
	if (!kind) return undefined;
	const exitCode = extractExitCode(event.details);
	return {
		kind,
		label: command,
		command,
		success: !event.isError,
		exitCode,
	};
}

function classifyValidation(command: string): ValidationRecord["kind"] | undefined {
	const normalized = command.toLowerCase();
	if (normalized.includes("npm run check") || normalized.includes("tsc") || normalized.includes("biome check")) {
		return "check";
	}
	if (normalized.includes("vitest") || normalized.includes("npm test") || normalized.includes("--run")) {
		return "test";
	}
	if (normalized.includes("eslint") || normalized.includes("biome lint")) {
		return "lint";
	}
	if (normalized.includes("build")) {
		return "build";
	}
	return undefined;
}

function extractExitCode(details: unknown): number | null {
	if (!details || typeof details !== "object") return null;
	const candidate = (details as { exitCode?: unknown }).exitCode;
	return typeof candidate === "number" ? candidate : null;
}

function isMeaningfulEvent(
	event: CapturablePiEvent,
	validation: ValidationRecord | undefined,
	filePaths: string[],
): boolean {
	if (event.type === "session_start" || event.type === "session_shutdown" || event.type === "before_agent_start") {
		return true;
	}
	if (event.type === "tool_result") return true;
	return filePaths.length > 0 || validation !== undefined || isMutatingEvent(event);
}
