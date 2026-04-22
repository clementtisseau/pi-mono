import type { Artifact, ChangeUnit } from "../../types.js";
import { formatRelativeAge } from "../../utils/time.js";

export function renderJournalWidget(options: { openChangeUnit?: ChangeUnit; latestArtifact?: Artifact }): string[] {
	if (options.openChangeUnit) {
		return [
			`Journal: open change unit`,
			`${options.openChangeUnit.workType} · ${options.openChangeUnit.filePaths[0] ?? "working tree"}`,
			`${options.openChangeUnit.eventCount} events · ${options.openChangeUnit.snapshotCount} snapshots`,
		];
	}
	if (options.latestArtifact) {
		return [
			`Journal: latest change`,
			options.latestArtifact.title,
			`${options.latestArtifact.status} · ${formatRelativeAge(options.latestArtifact.createdAt)}`,
		];
	}
	return ["Journal: idle", "No closed change units yet"];
}
