import { describe, expect, it } from "vitest";
import { ChangeUnitTracker } from "../src/capture/change-unit-tracker.js";
import type { ChangeUnit, NormalizedEvent } from "../src/types.js";

const tracker = new ChangeUnitTracker();

function createEvent(overrides: Partial<NormalizedEvent>): NormalizedEvent {
	return {
		id: "evt-1",
		sessionId: "session-1",
		kind: "tool_result",
		timestamp: 1,
		payload: {},
		status: "success",
		summary: "event",
		isMeaningful: true,
		isMutating: true,
		toolName: "write",
		filePaths: [],
		...overrides,
	};
}

function createChangeUnit(): ChangeUnit {
	return {
		id: "cu-1",
		sessionId: "session-1",
		status: "open",
		openedAt: 1,
		updatedAt: 1,
		title: "title",
		workType: "implementation",
		eventCount: 1,
		snapshotCount: 1,
		filePaths: ["src/index.ts"],
		lastPrompt: "fix typing",
		metadata: {
			mutationCount: 1,
			validationCount: 0,
			hasFailure: false,
			lastEventId: "evt-0",
			lastToolName: "write",
		},
	};
}

describe("change unit tracker", () => {
	it("opens a change unit on first mutating event", () => {
		const decision = tracker.decide(undefined, createEvent({ isMutating: true }));
		expect(decision.shouldOpen).toBe(true);
		expect(decision.shouldCloseCurrent).toBe(false);
	});

	it("closes on session shutdown", () => {
		const decision = tracker.decide(createChangeUnit(), createEvent({ kind: "session_shutdown", isMutating: false }));
		expect(decision.shouldCloseCurrent).toBe(true);
	});

	it("treats a clearly different prompt as a boundary", () => {
		const decision = tracker.decide(
			createChangeUnit(),
			createEvent({ kind: "agent_prompt", isMutating: false, payload: { prompt: "start the release flow" } }),
		);
		expect(decision.shouldCloseCurrent).toBe(true);
	});
});
