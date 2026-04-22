import type { DatabaseSync } from "node:sqlite";
import type { NormalizedEvent } from "../../types.js";

export class EventsRepository {
	constructor(private readonly database: DatabaseSync) {}

	append(event: NormalizedEvent): void {
		this.database
			.prepare(
				`INSERT INTO journal_events (
					id, session_id, change_unit_id, kind, status, timestamp, summary, is_meaningful, is_mutating, tool_name,
					file_paths_json, validation_json, payload_json
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				event.id,
				event.sessionId,
				event.changeUnitId ?? null,
				event.kind,
				event.status,
				event.timestamp,
				event.summary,
				event.isMeaningful ? 1 : 0,
				event.isMutating ? 1 : 0,
				event.toolName ?? null,
				JSON.stringify(event.filePaths),
				event.validation ? JSON.stringify(event.validation) : null,
				JSON.stringify(event.payload),
			);
	}

	assignChangeUnit(eventId: string, changeUnitId: string): void {
		this.database.prepare(`UPDATE journal_events SET change_unit_id = ? WHERE id = ?`).run(changeUnitId, eventId);
	}

	listByChangeUnit(changeUnitId: string): NormalizedEvent[] {
		const rows = this.database
			.prepare(
				`SELECT id, session_id, change_unit_id, kind, status, timestamp, summary, is_meaningful, is_mutating, tool_name,
				 file_paths_json, validation_json, payload_json
				 FROM journal_events
				 WHERE change_unit_id = ?
				 ORDER BY timestamp ASC`,
			)
			.all(changeUnitId) as unknown as EventRow[];
		return rows.map(mapEventRow);
	}
}

interface EventRow {
	id: string;
	session_id: string;
	change_unit_id: string | null;
	kind: NormalizedEvent["kind"];
	status: NormalizedEvent["status"];
	timestamp: number;
	summary: string;
	is_meaningful: number;
	is_mutating: number;
	tool_name: string | null;
	file_paths_json: string;
	validation_json: string | null;
	payload_json: string;
}

function mapEventRow(row: EventRow): NormalizedEvent {
	return {
		id: row.id,
		sessionId: row.session_id,
		changeUnitId: row.change_unit_id ?? undefined,
		kind: row.kind,
		status: row.status,
		timestamp: row.timestamp,
		summary: row.summary,
		isMeaningful: row.is_meaningful === 1,
		isMutating: row.is_mutating === 1,
		toolName: row.tool_name ?? undefined,
		filePaths: JSON.parse(row.file_paths_json) as string[],
		validation: row.validation_json ? (JSON.parse(row.validation_json) as NormalizedEvent["validation"]) : undefined,
		payload: JSON.parse(row.payload_json) as Record<string, unknown>,
	};
}
