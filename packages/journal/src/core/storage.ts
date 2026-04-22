import { DatabaseSync } from "node:sqlite";
import type { Artifact, GitSnapshot, JournalConfig } from "../types.js";
import { runMigrations } from "./migrations.js";

export class JournalStorage {
	private readonly database: DatabaseSync;

	constructor(public readonly config: JournalConfig) {
		this.database = new DatabaseSync(config.databasePath);
		runMigrations(this.database);
	}

	get db(): DatabaseSync {
		return this.database;
	}

	close(): void {
		this.database.close();
	}

	insertArtifact(artifact: Artifact): void {
		this.database
			.prepare(
				`INSERT OR REPLACE INTO artifacts (
					id, change_unit_id, kind, title, summary, body, status, work_type, created_at, file_paths_json, validations_json
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				artifact.id,
				artifact.changeUnitId,
				artifact.kind,
				artifact.title,
				artifact.summary,
				artifact.body,
				artifact.status,
				artifact.workType,
				artifact.createdAt,
				JSON.stringify(artifact.filePaths),
				JSON.stringify(artifact.validations),
			);
	}

	listRecentArtifacts(limit: number): Artifact[] {
		const rows = this.database
			.prepare(
				`SELECT id, change_unit_id, kind, title, summary, body, status, work_type, created_at, file_paths_json, validations_json
				 FROM artifacts
				 ORDER BY created_at DESC
				 LIMIT ?`,
			)
			.all(limit) as unknown as ArtifactRow[];
		return rows.map(mapArtifactRow);
	}

	getArtifactByChangeUnitId(changeUnitId: string): Artifact | undefined {
		const row = this.database
			.prepare(
				`SELECT id, change_unit_id, kind, title, summary, body, status, work_type, created_at, file_paths_json, validations_json
				 FROM artifacts WHERE change_unit_id = ?`,
			)
			.get(changeUnitId) as unknown as ArtifactRow | undefined;
		return row ? mapArtifactRow(row) : undefined;
	}

	insertGitSnapshot(snapshot: GitSnapshot): void {
		this.database
			.prepare(
				`INSERT OR REPLACE INTO git_snapshots (
					id, change_unit_id, event_id, captured_at, repo_path, worktree_path, branch, changed_files_json, stats_json
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				snapshot.id,
				snapshot.changeUnitId,
				snapshot.eventId,
				snapshot.capturedAt,
				snapshot.repoPath,
				snapshot.worktreePath,
				snapshot.branch,
				JSON.stringify(snapshot.changedFiles),
				JSON.stringify(snapshot.stats),
			);
	}

	getLatestSnapshot(changeUnitId: string): GitSnapshot | undefined {
		const row = this.database
			.prepare(
				`SELECT id, change_unit_id, event_id, captured_at, repo_path, worktree_path, branch, changed_files_json, stats_json
				 FROM git_snapshots WHERE change_unit_id = ? ORDER BY captured_at DESC LIMIT 1`,
			)
			.get(changeUnitId) as unknown as GitSnapshotRow | undefined;
		return row ? mapSnapshotRow(row) : undefined;
	}
}

interface ArtifactRow {
	id: string;
	change_unit_id: string;
	kind: "change_artifact";
	title: string;
	summary: string;
	body: string;
	status: Artifact["status"];
	work_type: Artifact["workType"];
	created_at: number;
	file_paths_json: string;
	validations_json: string;
}

interface GitSnapshotRow {
	id: string;
	change_unit_id: string;
	event_id: string;
	captured_at: number;
	repo_path: string;
	worktree_path: string;
	branch: string | null;
	changed_files_json: string;
	stats_json: string;
}

function mapArtifactRow(row: ArtifactRow): Artifact {
	return {
		id: row.id,
		changeUnitId: row.change_unit_id,
		kind: row.kind,
		title: row.title,
		summary: row.summary,
		body: row.body,
		status: row.status,
		workType: row.work_type,
		createdAt: row.created_at,
		filePaths: JSON.parse(row.file_paths_json) as string[],
		validations: JSON.parse(row.validations_json) as Artifact["validations"],
	};
}

function mapSnapshotRow(row: GitSnapshotRow): GitSnapshot {
	return {
		id: row.id,
		changeUnitId: row.change_unit_id,
		eventId: row.event_id,
		capturedAt: row.captured_at,
		repoPath: row.repo_path,
		worktreePath: row.worktree_path,
		branch: row.branch,
		changedFiles: JSON.parse(row.changed_files_json) as GitSnapshot["changedFiles"],
		stats: JSON.parse(row.stats_json) as GitSnapshot["stats"],
	};
}
