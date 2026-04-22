import type { ChangeUnit, NormalizedEvent } from "../types.js";

export interface ChangeUnitTrackerDecision {
	shouldOpen: boolean;
	shouldCloseCurrent: boolean;
	closeReason?: string;
}

export class ChangeUnitTracker {
	decide(current: ChangeUnit | undefined, event: NormalizedEvent): ChangeUnitTrackerDecision {
		if (!current) {
			return {
				shouldOpen: event.isMutating,
				shouldCloseCurrent: false,
			};
		}

		if (event.kind === "session_shutdown") {
			return {
				shouldOpen: false,
				shouldCloseCurrent: true,
				closeReason: "session_shutdown",
			};
		}

		if (
			event.kind === "agent_prompt" &&
			current.metadata.mutationCount > 0 &&
			typeof event.payload.prompt === "string"
		) {
			const nextPrompt = normalizePrompt(event.payload.prompt);
			const currentPrompt = normalizePrompt(current.lastPrompt);
			if (nextPrompt && currentPrompt && nextPrompt !== currentPrompt) {
				return {
					shouldOpen: false,
					shouldCloseCurrent: true,
					closeReason: "new_prompt_boundary",
				};
			}
		}

		return {
			shouldOpen: false,
			shouldCloseCurrent: false,
		};
	}
}

function normalizePrompt(value: string | undefined): string {
	return (value ?? "").trim().toLowerCase();
}
