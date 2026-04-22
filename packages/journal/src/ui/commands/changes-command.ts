import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import type { Artifact } from "../../types.js";

export function registerChangesCommand(pi: ExtensionAPI, listRecentArtifacts: (limit: number) => Artifact[]): void {
	pi.registerCommand("changes", {
		description: "Show recent journaled changes",
		handler: async (_args: string, ctx: ExtensionCommandContext) => {
			const artifacts = listRecentArtifacts(10);
			if (artifacts.length === 0) {
				ctx.ui.notify("No journaled changes yet", "info");
				return;
			}
			for (const artifact of artifacts) {
				pi.sendMessage({
					customType: "journal-change-artifact",
					content: artifact.summary,
					display: true,
					details: artifact,
				});
			}
		},
	});
}
