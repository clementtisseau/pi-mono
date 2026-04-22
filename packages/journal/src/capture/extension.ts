import type {
	BeforeAgentStartEvent,
	ExtensionAPI,
	ExtensionContext,
	SessionShutdownEvent,
	SessionStartEvent,
	ToolCallEvent,
	ToolResultEvent,
} from "@mariozechner/pi-coding-agent";
import { createJournalConfig } from "../config.js";
import { EventIngestionService } from "../core/services/event-ingestion-service.js";
import { JournalStorage } from "../core/storage.js";
import type { Artifact, SessionJournalState } from "../types.js";
import { registerChangesCommand } from "../ui/commands/changes-command.js";
import { createChangeCard } from "../ui/renderers/change-card.js";
import { renderJournalWidget } from "../ui/widgets/journal-widget.js";
import { logger } from "../utils/logger.js";

export function createJournalExtension() {
	return function journalExtension(pi: ExtensionAPI): void {
		let storage: JournalStorage | undefined;
		let ingestion: EventIngestionService | undefined;
		let state: SessionJournalState | undefined;

		const ensureRuntime = (ctx: ExtensionContext): EventIngestionService => {
			if (ingestion && storage && state) return ingestion;
			storage = new JournalStorage(createJournalConfig({ cwd: ctx.cwd }));
			ingestion = new EventIngestionService(storage);
			state = {
				sessionId: `session:${ctx.sessionManager.getSessionFile() ?? ctx.cwd}`,
				cwd: ctx.cwd,
			};
			return ingestion;
		};

		const handle = (
			ctx: ExtensionContext,
			event: SessionStartEvent | SessionShutdownEvent | BeforeAgentStartEvent | ToolCallEvent | ToolResultEvent,
		): void => {
			try {
				const runtime = ensureRuntime(ctx);
				const result = runtime.ingest({ sessionId: state?.sessionId ?? ctx.cwd, cwd: ctx.cwd }, event);
				if (state) {
					state.currentChangeUnitId = result.currentChangeUnit?.id;
					if (event.type === "before_agent_start") state.lastPrompt = event.prompt;
				}
				updateWidget(ctx, runtime, result.artifact);
			} catch (error) {
				logger.error("Failed to ingest journal event", {
					error: error instanceof Error ? error.message : String(error),
				});
			}
		};

		const updateWidget = (ctx: ExtensionContext, runtime: EventIngestionService, artifact?: Artifact): void => {
			const openChangeUnit = state ? runtime.getCurrentChangeUnit(state.sessionId) : undefined;
			const latestArtifact = artifact ?? runtime.listRecentArtifacts(1)[0];
			ctx.ui.setWidget(
				"pi-journal",
				renderJournalWidget({
					openChangeUnit,
					latestArtifact,
				}),
			);
		};

		pi.registerMessageRenderer("journal-change-artifact", (message, _options, theme) => {
			const artifact = message.details as Artifact | undefined;
			if (!artifact) return undefined;
			return createChangeCard(artifact, theme);
		});

		registerChangesCommand(pi, (limit) => (storage ? storage.listRecentArtifacts(limit) : []));

		pi.on("session_start", (event, ctx) => {
			ensureRuntime(ctx);
			handle(ctx, event);
		});
		pi.on("session_shutdown", (event, ctx) => {
			handle(ctx, event);
			ctx.ui.setWidget("pi-journal", undefined);
			storage?.close();
			storage = undefined;
			ingestion = undefined;
			state = undefined;
		});
		pi.on("before_agent_start", (event, ctx) => {
			handle(ctx, event);
		});
		pi.on("tool_call", (event, ctx) => {
			handle(ctx, event);
		});
		pi.on("tool_result", (event, ctx) => {
			handle(ctx, event);
		});
	};
}

export default createJournalExtension();
