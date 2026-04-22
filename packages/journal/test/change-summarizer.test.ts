import { describe, expect, it } from "vitest";
import { ChangeSummarizer, determineWorkType } from "../src/core/summarization/change-summarizer.js";
import type { ChangeUnit, NormalizedEvent } from "../src/types.js";

const summarizer = new ChangeSummarizer();

function event(overrides: Partial<NormalizedEvent>): NormalizedEvent {
	return {
		id: "evt",
		sessionId: "session",
		kind: "tool_result",
		timestamp: 1,
		payload: {},
		status: "success",
		summary: "write file",
		isMeaningful: true,
		isMutating: true,
		toolName: "write",
		filePaths: ["src/index.ts"],
		...overrides,
	};
}

const changeUnit: ChangeUnit = {
	id: "cu",
	sessionId: "session",
	status: "closed",
	openedAt: 1,
	updatedAt: 2,
	closedAt: 2,
	title: "implementation change in src/index.ts",
	workType: "mixed",
	eventCount: 2,
	snapshotCount: 1,
	filePaths: ["src/index.ts"],
	metadata: {
		mutationCount: 1,
		validationCount: 1,
		hasFailure: false,
	},
};

describe("change summarizer", () => {
	it("classifies mixed work from mutation plus validation", () => {
		expect(
			determineWorkType([
				event({ isMutating: true }),
				event({
					isMutating: false,
					validation: {
						kind: "check",
						label: "npm run check",
						command: "npm run check",
						success: true,
						exitCode: 0,
					},
				}),
			]),
		).toBe("mixed");
	});

	it("builds an artifact with files and validation", () => {
		const artifact = summarizer.summarize({
			changeUnit,
			events: [
				event({ isMutating: true }),
				event({
					isMutating: false,
					validation: {
						kind: "check",
						label: "npm run check",
						command: "npm run check",
						success: true,
						exitCode: 0,
					},
				}),
			],
		});

		expect(artifact.title).toContain("Mixed");
		expect(artifact.filePaths).toEqual(["src/index.ts"]);
		expect(artifact.validations).toHaveLength(1);
		expect(artifact.status).toBe("completed");
	});
});
