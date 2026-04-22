import type { DatabaseSync } from "node:sqlite";
import type { ChangeUnit } from "../../types.js";

export class ChangeUnitsRepository {
	constructor(private readonly database: DatabaseSync) {}

	insert(changeUnit: ChangeUnit): void {
		this.database
			.prepare(
				`INSERT INTO change_units (
					id, session_id, status, opened_at, updated_at, closed_at, title, work_type, event_count, snapshot_count,
					file_paths_json, last_prompt, metadata_json
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				changeUnit.id,
				changeUnit.sessionId,
				changeUnit.status,
				changeUnit.openedAt,
				changeUnit.updatedAt,
				changeUnit.closedAt ?? null,
				changeUnit.title,
				changeUnit.workType,
				changeUnit.eventCount,
				changeUnit.snapshotCount,
				JSON.stringify(changeUnit.filePaths),
				changeUnit.lastPrompt ?? null,
				JSON.stringify(changeUnit.metadata),
			);
	}

	update(changeUnit: ChangeUnit): void {
		this.database
			.prepare(
				`UPDATE change_units SET
					status = ?, updated_at = ?, closed_at = ?, title = ?, work_type = ?, event_count = ?, snapshot_count = ?,
					file_paths_json = ?, last_prompt = ?, metadata_json = ?
				 WHERE id = ?`,
			)
			.run(
				changeUnit.status,
				changeUnit.updatedAt,
				changeUnit.closedAt ?? null,
				changeUnit.title,
				changeUnit.workType,
				changeUnit.eventCount,
				changeUnit.snapshotCount,
				JSON.stringify(changeUnit.filePaths),
				changeUnit.lastPrompt ?? null,
				JSON.stringify(changeUnit.metadata),
				changeUnit.id,
			);
	}

	getOpenBySession(sessionId: string): ChangeUnit | undefined {
		const row = this.database
			.prepare(
				`SELECT id, session_id, status, opened_at, updated_at, closed_at, title, work_type, event_count, snapshot_count,
				 file_paths_json, last_prompt, metadata_json
				 FROM change_units WHERE session_id = ? AND status = 'open' ORDER BY updated_at DESC LIMIT 1`,
			)
			.get(sessionId) as unknown as ChangeUnitRow | undefined;
		return row ? mapChangeUnitRow(row) : undefined;
	}

	getById(id: string): ChangeUnit | undefined {
		const row = this.database
			.prepare(
				`SELECT id, session_id, status, opened_at, updated_at, closed_at, title, work_type, event_count, snapshot_count,
				 file_paths_json, last_prompt, metadata_json
				 FROM change_units WHERE id = ?`,
			)
			.get(id) as unknown as ChangeUnitRow | undefined;
		return row ? mapChangeUnitRow(row) : undefined;
	}

	listRecent(limit: number): ChangeUnit[] {
		const rows = this.database
			.prepare(
				`SELECT id, session_id, status, opened_at, updated_at, closed_at, title, work_type, event_count, snapshot_count,
				 file_paths_json, last_prompt, metadata_json
				 FROM change_units ORDER BY updated_at DESC LIMIT ?`,
			)
			.all(limit) as unknown as ChangeUnitRow[];
		return rows.map(mapChangeUnitRow);
	}
}

interface ChangeUnitRow {
	id: string;
	session_id: string;
	status: ChangeUnit["status"];
	opened_at: number;
	updated_at: number;
	closed_at: number | null;
	title: string;
	work_type: ChangeUnit["workType"];
	event_count: number;
	snapshot_count: number;
	file_paths_json: string;
	last_prompt: string | null;
	metadata_json: string;
}

function mapChangeUnitRow(row: ChangeUnitRow): ChangeUnit {
	return {
		id: row.id,
		sessionId: row.session_id,
		status: row.status,
		openedAt: row.opened_at,
		updatedAt: row.updated_at,
		closedAt: row.closed_at ?? undefined,
		title: row.title,
		workType: row.work_type,
		eventCount: row.event_count,
		snapshotCount: row.snapshot_count,
		filePaths: JSON.parse(row.file_paths_json) as string[],
		lastPrompt: row.last_prompt ?? undefined,
		metadata: JSON.parse(row.metadata_json) as ChangeUnit["metadata"],
	};
}
