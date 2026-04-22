import { join } from "node:path";
import type { JournalConfig } from "./types.js";
import { ensureJournalStorageDir, resolveJournalStorageDir } from "./utils/paths.js";

export const DEFAULT_RECENT_ARTIFACTS_LIMIT = 10;
export const DEFAULT_WIDGET_KEY = "pi-journal";
export const JOURNAL_DB_FILENAME = "journal.sqlite";

export interface CreateJournalConfigOptions {
	cwd: string;
}

export function createJournalConfig(options: CreateJournalConfigOptions): JournalConfig {
	const storageDir = ensureJournalStorageDir(resolveJournalStorageDir(options.cwd));
	return {
		storageDir,
		databasePath: join(storageDir, JOURNAL_DB_FILENAME),
		widgetKey: DEFAULT_WIDGET_KEY,
		recentArtifactsLimit: DEFAULT_RECENT_ARTIFACTS_LIMIT,
	};
}
