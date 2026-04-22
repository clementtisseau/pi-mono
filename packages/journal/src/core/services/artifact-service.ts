import type { Artifact, ChangeUnit, GitSnapshot, NormalizedEvent } from "../../types.js";
import type { JournalStorage } from "../storage.js";
import { ChangeSummarizer } from "../summarization/change-summarizer.js";

export class ArtifactService {
	private readonly summarizer = new ChangeSummarizer();

	constructor(private readonly storage: JournalStorage) {}

	createAndStore(changeUnit: ChangeUnit, events: NormalizedEvent[], snapshot?: GitSnapshot): Artifact {
		const artifact = this.summarizer.summarize({ changeUnit, events, snapshot });
		this.storage.insertArtifact(artifact);
		return artifact;
	}
}
