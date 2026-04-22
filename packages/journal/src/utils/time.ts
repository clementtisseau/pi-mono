export function now(): number {
	return Date.now();
}

export function formatTimestamp(timestamp: number): string {
	return new Date(timestamp).toISOString();
}

export function formatRelativeAge(from: number, to: number = Date.now()): string {
	const deltaMs = Math.max(0, to - from);
	const minutes = Math.floor(deltaMs / 60_000);
	if (minutes < 1) return "just now";
	if (minutes === 1) return "1 minute ago";
	if (minutes < 60) return `${minutes} minutes ago`;
	const hours = Math.floor(minutes / 60);
	if (hours === 1) return "1 hour ago";
	return `${hours} hours ago`;
}
