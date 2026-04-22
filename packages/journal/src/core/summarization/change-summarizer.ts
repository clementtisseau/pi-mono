import type { Artifact, ChangeUnit, GitSnapshot, NormalizedEvent, ValidationRecord } from "../../types.js";
import { createId } from "../../utils/ids.js";
import { formatTimestamp } from "../../utils/time.js";

export interface SummarizeChangeUnitOptions {
	changeUnit: ChangeUnit;
	events: NormalizedEvent[];
	snapshot?: GitSnapshot;
}

export class ChangeSummarizer {
	summarize(options: SummarizeChangeUnitOptions): Artifact {
		const { changeUnit, events, snapshot } = options;
		const filePaths = dedupe(changeUnit.filePaths);
		const validations = dedupeValidations(events.flatMap((event) => (event.validation ? [event.validation] : [])));
		const status = determineArtifactStatus(changeUnit, validations);
		const touched = filePaths.length > 0 ? filePaths.join(", ") : "no tracked files";
		const title = `${capitalize(changeUnit.workType)} change in ${filePaths[0] ?? "working tree"}`;
		const summary = `${capitalize(changeUnit.workType)} touching ${touched}`;
		const body = [
			`Title: ${title}`,
			`When: ${formatTimestamp(changeUnit.openedAt)}`,
			`Work type: ${changeUnit.workType}`,
			`Status: ${status}`,
			`Files: ${filePaths.length > 0 ? touched : "none"}`,
			`Events: ${changeUnit.eventCount}`,
			`Git snapshots: ${changeUnit.snapshotCount}`,
			validationLine(validations),
			snapshotLine(snapshot),
		].join("\n");

		return {
			id: createId("art"),
			changeUnitId: changeUnit.id,
			kind: "change_artifact",
			title,
			summary,
			body,
			status,
			workType: changeUnit.workType,
			createdAt: Date.now(),
			filePaths,
			validations,
		};
	}
}

export function determineWorkType(events: NormalizedEvent[]): ChangeUnit["workType"] {
	const hasMutation = events.some((event) => event.isMutating);
	const hasValidation = events.some((event) => event.validation !== undefined);
	if (hasMutation && hasValidation) return "mixed";
	if (hasMutation) return "implementation";
	if (hasValidation) return "validation";
	if (events.some((event) => event.kind === "tool_call" || event.kind === "tool_result")) return "inspection";
	return "unknown";
}

function determineArtifactStatus(changeUnit: ChangeUnit, validations: ValidationRecord[]): Artifact["status"] {
	if (changeUnit.metadata.hasFailure) return "failed";
	if (validations.length > 0 && validations.every((validation) => validation.success)) return "completed";
	if (changeUnit.metadata.mutationCount > 0) return "partial";
	return "unknown";
}

function validationLine(validations: ValidationRecord[]): string {
	if (validations.length === 0) return "Validation: none recorded";
	return `Validation: ${validations.map((validation) => `${validation.kind}:${validation.success ? "ok" : "failed"}`).join(", ")}`;
}

function snapshotLine(snapshot: GitSnapshot | undefined): string {
	if (!snapshot) return "Snapshot: none";
	return `Snapshot: ${snapshot.stats.files} files changed, +${snapshot.stats.additions}/-${snapshot.stats.deletions}`;
}

function dedupe(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function dedupeValidations(values: ValidationRecord[]): ValidationRecord[] {
	const seen = new Set<string>();
	const result: ValidationRecord[] = [];
	for (const value of values) {
		const key = `${value.kind}:${value.command}:${value.exitCode}:${value.success}`;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(value);
	}
	return result;
}

function capitalize(value: string): string {
	return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}
