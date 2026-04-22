import type { CapturablePiEvent } from "../../capture/event-normalizer.js";
import { normalizeEvent } from "../../capture/event-normalizer.js";
import { captureGitSnapshot } from "../../capture/git-snapshot.js";
import type { Artifact, ChangeUnit } from "../../types.js";
import { EventsRepository } from "../repositories/events-repository.js";
import type { JournalStorage } from "../storage.js";
import { ArtifactService } from "./artifact-service.js";
import { ChangeUnitService } from "./change-unit-service.js";

export interface IngestEventContext {
	sessionId: string;
	cwd: string;
}

export interface IngestionResult {
	eventId: string;
	currentChangeUnit?: ChangeUnit;
	closedChangeUnit?: ChangeUnit;
	artifact?: Artifact;
}

export class EventIngestionService {
	private readonly events: EventsRepository;
	private readonly changeUnits: ChangeUnitService;
	private readonly artifacts: ArtifactService;

	constructor(private readonly storage: JournalStorage) {
		this.events = new EventsRepository(storage.db);
		this.changeUnits = new ChangeUnitService(storage, this.events);
		this.artifacts = new ArtifactService(storage);
	}

	ingest(context: IngestEventContext, event: CapturablePiEvent): IngestionResult {
		const normalized = normalizeEvent(context.sessionId, event);
		this.events.append(normalized);

		const handled = this.changeUnits.handleEvent(context.sessionId, normalized);
		let currentChangeUnit = handled.current;

		if (
			currentChangeUnit &&
			normalized.isMutating &&
			normalized.kind === "tool_result" &&
			normalized.status === "success"
		) {
			const snapshot = captureGitSnapshot({
				cwd: context.cwd,
				changeUnitId: currentChangeUnit.id,
				eventId: normalized.id,
			});
			if (snapshot) {
				currentChangeUnit = this.changeUnits.attachSnapshot(currentChangeUnit.id, snapshot) ?? currentChangeUnit;
			}
		}

		let artifact: Artifact | undefined;
		let closedChangeUnit = handled.closed?.changeUnit;

		if (normalized.kind === "session_shutdown") {
			const closed = this.changeUnits.closeOpenForSession(context.sessionId, normalized.timestamp) ?? handled.closed;
			if (closed) {
				closedChangeUnit = closed.changeUnit;
				artifact = this.artifacts.createAndStore(closed.changeUnit, closed.events, closed.snapshot);
			}
		} else if (handled.closed) {
			artifact = this.artifacts.createAndStore(
				handled.closed.changeUnit,
				handled.closed.events,
				handled.closed.snapshot,
			);
		}

		return {
			eventId: normalized.id,
			currentChangeUnit,
			closedChangeUnit,
			artifact,
		};
	}

	listRecentArtifacts(limit: number): Artifact[] {
		return this.storage.listRecentArtifacts(limit);
	}

	getCurrentChangeUnit(sessionId: string): ChangeUnit | undefined {
		return this.changeUnits.getOpenChangeUnit(sessionId);
	}
}
