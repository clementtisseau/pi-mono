import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

export function findGitDir(startCwd: string): string {
	let current = resolve(startCwd);
	while (true) {
		const candidate = join(current, ".git");
		if (exists(candidate)) return resolveGitDir(candidate);
		const parent = dirname(current);
		if (parent === current) return candidate;
		current = parent;
	}
}

export function resolveJournalStorageDir(cwd: string): string {
	return join(findGitDir(cwd), "pi-journal");
}

export function ensureJournalStorageDir(storageDir: string): string {
	mkdirSync(storageDir, { recursive: true });
	return storageDir;
}

function exists(path: string): boolean {
	return existsSync(path);
}

function resolveGitDir(gitPath: string): string {
	try {
		if (statSync(gitPath).isDirectory()) return gitPath;
		const content = readFileSync(gitPath, "utf8").trim();
		const prefix = "gitdir:";
		if (!content.startsWith(prefix)) return gitPath;
		const gitDir = content.slice(prefix.length).trim();
		return isAbsolute(gitDir) ? gitDir : resolve(dirname(gitPath), gitDir);
	} catch {
		return gitPath;
	}
}
