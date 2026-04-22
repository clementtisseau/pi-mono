import type { DatabaseSync } from "node:sqlite";

export function runMigrations(database: DatabaseSync): void {
	database.exec(`
		CREATE TABLE IF NOT EXISTS journal_meta (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);

		CREATE TABLE IF NOT EXISTS journal_events (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL,
			change_unit_id TEXT,
			kind TEXT NOT NULL,
			status TEXT NOT NULL,
			timestamp INTEGER NOT NULL,
			summary TEXT NOT NULL,
			is_meaningful INTEGER NOT NULL,
			is_mutating INTEGER NOT NULL,
			tool_name TEXT,
			file_paths_json TEXT NOT NULL,
			validation_json TEXT,
			payload_json TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_journal_events_session_time ON journal_events(session_id, timestamp DESC);
		CREATE INDEX IF NOT EXISTS idx_journal_events_change_unit ON journal_events(change_unit_id, timestamp ASC);

		CREATE TABLE IF NOT EXISTS change_units (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL,
			status TEXT NOT NULL,
			opened_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			closed_at INTEGER,
			title TEXT NOT NULL,
			work_type TEXT NOT NULL,
			event_count INTEGER NOT NULL,
			snapshot_count INTEGER NOT NULL,
			file_paths_json TEXT NOT NULL,
			last_prompt TEXT,
			metadata_json TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_change_units_session_updated ON change_units(session_id, updated_at DESC);
		CREATE INDEX IF NOT EXISTS idx_change_units_status ON change_units(status, updated_at DESC);

		CREATE TABLE IF NOT EXISTS git_snapshots (
			id TEXT PRIMARY KEY,
			change_unit_id TEXT NOT NULL,
			event_id TEXT NOT NULL,
			captured_at INTEGER NOT NULL,
			repo_path TEXT NOT NULL,
			worktree_path TEXT NOT NULL,
			branch TEXT,
			changed_files_json TEXT NOT NULL,
			stats_json TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_git_snapshots_change_unit ON git_snapshots(change_unit_id, captured_at DESC);

		CREATE TABLE IF NOT EXISTS artifacts (
			id TEXT PRIMARY KEY,
			change_unit_id TEXT NOT NULL UNIQUE,
			kind TEXT NOT NULL,
			title TEXT NOT NULL,
			summary TEXT NOT NULL,
			body TEXT NOT NULL,
			status TEXT NOT NULL,
			work_type TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			file_paths_json TEXT NOT NULL,
			validations_json TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_artifacts_created_at ON artifacts(created_at DESC);
	`);
}
