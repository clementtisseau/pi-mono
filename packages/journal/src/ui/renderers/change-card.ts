import type { Theme } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
import { Box, Text } from "@mariozechner/pi-tui";
import type { Artifact } from "../../types.js";

export function createChangeCard(artifact: Artifact, theme: Theme): Component {
	const box = new Box(1, 1, (value) => theme.bg("customMessageBg", value));
	const lines = [
		`${theme.fg("accent", artifact.title)}`,
		`${theme.fg("dim", `${artifact.status} · ${artifact.workType}`)}`,
		artifact.summary,
		artifact.filePaths.length > 0 ? `Files: ${artifact.filePaths.join(", ")}` : "Files: none",
		artifact.validations.length > 0
			? `Validation: ${artifact.validations.map((value) => `${value.kind}:${value.success ? "ok" : "failed"}`).join(", ")}`
			: "Validation: none",
	];
	box.addChild(new Text(lines.join("\n"), 0, 0));
	return box;
}
