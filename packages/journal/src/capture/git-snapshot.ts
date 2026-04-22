import { execFileSync } from "node:child_process";
import type { GitChangedFile, GitSnapshot } from "../types.js";
import { createId } from "../utils/ids.js";
import { now } from "../utils/time.js";

export interface CaptureGitSnapshotOptions {
	cwd: string;
	changeUnitId: string;
	eventId: string;
}

export function captureGitSnapshot(options: CaptureGitSnapshotOptions): GitSnapshot | undefined {
	const repoPath = runGit(options.cwd, ["rev-parse", "--show-toplevel"]);
	if (!repoPath) return undefined;

	const branch = runGit(repoPath, ["branch", "--show-current"]);
	const statusLines = runGit(repoPath, ["status", "--porcelain"]);
	const diffLines = runGit(repoPath, ["diff", "--numstat", "--relative"]);
	const cachedDiffLines = runGit(repoPath, ["diff", "--cached", "--numstat", "--relative"]);
	const changedFiles = mergeChangedFiles(statusLines, diffLines, cachedDiffLines);

	return {
		id: createId("snap"),
		changeUnitId: options.changeUnitId,
		eventId: options.eventId,
		capturedAt: now(),
		repoPath,
		worktreePath: options.cwd,
		branch: branch || null,
		changedFiles,
		stats: {
			files: changedFiles.length,
			additions: changedFiles.reduce((sum, file) => sum + (file.additions ?? 0), 0),
			deletions: changedFiles.reduce((sum, file) => sum + (file.deletions ?? 0), 0),
		},
	};
}

function runGit(cwd: string, args: string[]): string {
	try {
		return execFileSync("git", args, {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		})
			.trim()
			.replace(/\r/g, "");
	} catch {
		return "";
	}
}

function mergeChangedFiles(...sources: string[]): GitChangedFile[] {
	const merged = new Map<string, GitChangedFile>();
	for (const source of sources) {
		for (const line of source
			.split("\n")
			.map((value) => value.trim())
			.filter(Boolean)) {
			const file = parseChangedFile(line);
			const existing = merged.get(file.path);
			if (!existing) {
				merged.set(file.path, file);
				continue;
			}
			merged.set(file.path, {
				...existing,
				status: existing.status === "unknown" ? file.status : existing.status,
				additions: coalesceNumber(existing.additions, file.additions),
				deletions: coalesceNumber(existing.deletions, file.deletions),
			});
		}
	}
	return [...merged.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function parseChangedFile(line: string): GitChangedFile {
	if (line.includes("\t")) {
		const [additionsText, deletionsText, ...pathParts] = line.split("\t");
		return {
			path: pathParts.join("\t"),
			status: "modified",
			additions: parseNumstatValue(additionsText),
			deletions: parseNumstatValue(deletionsText),
		};
	}

	const statusCode = line.slice(0, 2).trim();
	const path = line.slice(3).trim();
	return {
		path,
		status: statusFromPorcelain(statusCode),
		additions: null,
		deletions: null,
	};
}

function parseNumstatValue(value: string): number | null {
	return /^\d+$/.test(value) ? Number(value) : null;
}

function statusFromPorcelain(code: string): GitChangedFile["status"] {
	if (code.includes("??")) return "untracked";
	if (code.includes("A")) return "added";
	if (code.includes("D")) return "deleted";
	if (code.includes("R")) return "renamed";
	if (code.includes("M")) return "modified";
	return "unknown";
}

function coalesceNumber(left: number | null, right: number | null): number | null {
	if (left === null) return right;
	if (right === null) return left;
	return Math.max(left, right);
}
