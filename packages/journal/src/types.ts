export type JournalEventKind =
	| "session_start"
	| "session_shutdown"
	| "agent_prompt"
	| "tool_call"
	| "tool_result"
	| "git_snapshot"
	| "artifact_created";

export type JournalEventStatus = "info" | "success" | "error";
export type ChangeUnitStatus = "open" | "closed";
export type ArtifactStatus = "completed" | "partial" | "failed" | "unknown";
export type ChangeWorkType = "implementation" | "validation" | "inspection" | "mixed" | "unknown";

export interface ValidationRecord {
	kind: "test" | "check" | "build" | "lint" | "command";
	label: string;
	command: string;
	success: boolean;
	exitCode: number | null;
}

export interface GitChangedFile {
	path: string;
	status: "modified" | "added" | "deleted" | "renamed" | "untracked" | "unknown";
	additions: number | null;
	deletions: number | null;
}

export interface GitSnapshot {
	id: string;
	changeUnitId: string;
	eventId: string;
	capturedAt: number;
	repoPath: string;
	worktreePath: string;
	branch: string | null;
	changedFiles: GitChangedFile[];
	stats: {
		files: number;
		additions: number;
		deletions: number;
	};
}

export interface JournalEvent {
	sessionId: string;
	kind: JournalEventKind;
	timestamp: number;
	payload: Record<string, unknown>;
}

export interface NormalizedEvent extends JournalEvent {
	id: string;
	status: JournalEventStatus;
	summary: string;
	isMeaningful: boolean;
	isMutating: boolean;
	toolName?: string;
	filePaths: string[];
	validation?: ValidationRecord;
	changeUnitId?: string;
}

export interface ChangeUnit {
	id: string;
	sessionId: string;
	status: ChangeUnitStatus;
	openedAt: number;
	updatedAt: number;
	closedAt?: number;
	title: string;
	workType: ChangeWorkType;
	eventCount: number;
	snapshotCount: number;
	filePaths: string[];
	lastPrompt?: string;
	metadata: {
		lastEventId?: string;
		lastToolName?: string;
		mutationCount: number;
		validationCount: number;
		hasFailure: boolean;
	};
}

export interface Artifact {
	id: string;
	changeUnitId: string;
	kind: "change_artifact";
	title: string;
	summary: string;
	body: string;
	status: ArtifactStatus;
	workType: ChangeWorkType;
	createdAt: number;
	filePaths: string[];
	validations: ValidationRecord[];
}

export interface JournalConfig {
	databasePath: string;
	storageDir: string;
	widgetKey: string;
	recentArtifactsLimit: number;
}

export interface RecentChangeView {
	changeUnit: ChangeUnit;
	artifact?: Artifact;
	lastSnapshot?: GitSnapshot;
}

export interface SessionJournalState {
	sessionId: string;
	cwd: string;
	currentChangeUnitId?: string;
	lastPrompt?: string;
}
