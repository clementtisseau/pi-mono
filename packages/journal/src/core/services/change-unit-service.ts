import { ChangeUnitTracker } from "../../capture/change-unit-tracker.js";
import type { ChangeUnit, GitSnapshot, NormalizedEvent } from "../../types.js";
import { createId } from "../../utils/ids.js";
import { now } from "../../utils/time.js";
import { ChangeUnitsRepository } from "../repositories/change-units-repository.js";
import type { EventsRepository } from "../repositories/events-repository.js";
import type { JournalStorage } from "../storage.js";
import { determineWorkType } from "../summarization/change-summarizer.js";

export interface CloseChangeUnitResult {
	changeUnit: ChangeUnit;
	events: NormalizedEvent[];
	snapshot?: GitSnapshot;
}

export class ChangeUnitService {
	private readonly tracker = new ChangeUnitTracker();
	private readonly changeUnits: ChangeUnitsRepository;

	constructor(
		private readonly storage: JournalStorage,
		private readonly events: EventsRepository,
	) {
		this.changeUnits = new ChangeUnitsRepository(storage.db);
	}

	getOpenChangeUnit(sessionId: string): ChangeUnit | undefined {
		return this.changeUnits.getOpenBySession(sessionId);
	}

	handleEvent(sessionId: string, event: NormalizedEvent): { current?: ChangeUnit; closed?: CloseChangeUnitResult } {
		const current = this.getOpenChangeUnit(sessionId);
		const decision = this.tracker.decide(current, event);
		let closed: CloseChangeUnitResult | undefined;
		let active = current;

		if (decision.shouldCloseCurrent && current) {
			closed = this.close(current.id, event.timestamp);
			active = undefined;
		}

		if (!active && decision.shouldOpen) {
			active = this.openForEvent(event);
		}

		if (active) {
			this.attachEvent(active, event);
			return { current: this.changeUnits.getById(active.id), closed };
		}

		return { current: undefined, closed };
	}

	attachSnapshot(changeUnitId: string, snapshot: GitSnapshot): ChangeUnit | undefined {
		this.storage.insertGitSnapshot(snapshot);
		const changeUnit = this.changeUnits.getById(changeUnitId);
		if (!changeUnit) return undefined;
		changeUnit.snapshotCount += 1;
		changeUnit.updatedAt = Math.max(changeUnit.updatedAt, snapshot.capturedAt);
		this.changeUnits.update(changeUnit);
		return changeUnit;
	}

	closeOpenForSession(sessionId: string, timestamp: number): CloseChangeUnitResult | undefined {
		const current = this.getOpenChangeUnit(sessionId);
		if (!current) return undefined;
		return this.close(current.id, timestamp);
	}

	listRecent(limit: number): ChangeUnit[] {
		return this.changeUnits.listRecent(limit);
	}

	private openForEvent(event: NormalizedEvent): ChangeUnit {
		const changeUnit: ChangeUnit = {
			id: createId("cu"),
			sessionId: event.sessionId,
			status: "open",
			openedAt: event.timestamp,
			updatedAt: event.timestamp,
			title: event.summary,
			workType: event.isMutating ? "implementation" : "unknown",
			eventCount: 0,
			snapshotCount: 0,
			filePaths: [],
			lastPrompt: undefined,
			metadata: {
				mutationCount: 0,
				validationCount: 0,
				hasFailure: false,
				lastEventId: undefined,
				lastToolName: undefined,
			},
		};
		this.changeUnits.insert(changeUnit);
		return changeUnit;
	}

	private attachEvent(changeUnit: ChangeUnit, event: NormalizedEvent): void {
		this.events.assignChangeUnit(event.id, changeUnit.id);
		changeUnit.updatedAt = event.timestamp;
		changeUnit.eventCount += 1;
		changeUnit.filePaths = [...new Set([...changeUnit.filePaths, ...event.filePaths])].sort((left, right) =>
			left.localeCompare(right),
		);
		changeUnit.metadata.lastEventId = event.id;
		changeUnit.metadata.lastToolName = event.toolName;
		changeUnit.metadata.hasFailure = changeUnit.metadata.hasFailure || event.status === "error";
		if (event.isMutating && event.kind === "tool_result" && event.status === "success") {
			changeUnit.metadata.mutationCount += 1;
		}
		if (event.validation) {
			changeUnit.metadata.validationCount += 1;
		}
		if (event.kind === "agent_prompt" && typeof event.payload.prompt === "string") {
			changeUnit.lastPrompt = event.payload.prompt;
		}
		changeUnit.workType = determineWorkType(this.events.listByChangeUnit(changeUnit.id));
		changeUnit.title = buildTitle(changeUnit, event);
		this.changeUnits.update(changeUnit);
	}

	private close(changeUnitId: string, timestamp: number): CloseChangeUnitResult {
		const changeUnit = this.changeUnits.getById(changeUnitId);
		if (!changeUnit) {
			throw new Error(`Unknown change unit: ${changeUnitId}`);
		}
		changeUnit.status = "closed";
		changeUnit.closedAt = timestamp > 0 ? timestamp : now();
		changeUnit.updatedAt = changeUnit.closedAt;
		this.changeUnits.update(changeUnit);
		const events = this.events.listByChangeUnit(changeUnit.id);
		const snapshot = this.storage.getLatestSnapshot(changeUnit.id);
		return { changeUnit, events, snapshot };
	}
}

function buildTitle(changeUnit: ChangeUnit, event: NormalizedEvent): string {
	if (changeUnit.filePaths.length > 0) {
		return `${changeUnit.workType} change in ${changeUnit.filePaths[0]}`;
	}
	return event.summary;
}
