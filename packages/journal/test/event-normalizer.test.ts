import { describe, expect, it } from "vitest";
import { isLikelyMutatingCommand, normalizeEvent } from "../src/capture/event-normalizer.js";

describe("event normalizer", () => {
	it("marks write results as mutating", () => {
		const event = normalizeEvent("session-1", {
			type: "tool_result",
			toolCallId: "call-1",
			toolName: "write",
			input: { path: "src/index.ts", content: "export {};" },
			content: [],
			details: undefined,
			isError: false,
		});

		expect(event.kind).toBe("tool_result");
		expect(event.isMutating).toBe(true);
		expect(event.filePaths).toEqual(["src/index.ts"]);
	});

	it("detects validation commands from bash", () => {
		const event = normalizeEvent("session-1", {
			type: "tool_result",
			toolCallId: "call-2",
			toolName: "bash",
			input: { command: "npm run check" },
			content: [],
			details: { exitCode: 0 },
			isError: false,
		});

		expect(event.validation?.kind).toBe("check");
		expect(event.validation?.success).toBe(true);
	});

	it("keeps obvious read and validation commands non-mutating", () => {
		expect(isLikelyMutatingCommand("git status --short")).toBe(false);
		expect(isLikelyMutatingCommand("git diff --stat")).toBe(false);
		expect(isLikelyMutatingCommand("npm run check")).toBe(false);
		expect(isLikelyMutatingCommand("python scripts/rewrite-docs.py")).toBe(true);
	});
});
