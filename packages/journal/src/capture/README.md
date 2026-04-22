# Capture subsystem

This folder contains the journal package's input-side logic: it listens to Pi events, normalizes them into journal events, decides when a unit of work starts and ends, and captures Git state after successful mutating operations.

It is a good place to start when you want to understand how the journal observes agent activity.

## Responsibilities

`src/capture/` is responsible for:

- receiving raw Pi extension events
- converting them into the journal's internal event shape
- deciding whether an event represents meaningful or mutating work
- deciding change-unit boundaries
- taking Git snapshots after successful mutations

It is not responsible for long-term persistence, summarization, or rendering stored history. Those concerns live mostly under `src/core/` and `src/ui/`.

## Files

### `extension.ts`

This is the runtime entry point for the package as a Pi extension.

It:

- creates the journal runtime lazily on first use
- creates `JournalStorage`
- creates `EventIngestionService`
- maintains small per-session state
- subscribes to Pi lifecycle and tool events
- forwards those events into the ingestion pipeline
- updates the journal widget
- registers the `/changes` command and the change artifact renderer

Read this file first if you want the top-level control flow.

### `event-normalizer.ts`

This file translates raw Pi events into `NormalizedEvent` objects used by the rest of the package.

It decides:

- the journal event kind
- the event status
- the summary text
- whether the event is meaningful
- whether the event is mutating
- which file paths are involved
- whether a bash command should be treated as validation

Important functions:

- `normalizeEvent()`
- `isMutatingEvent()`
- `isLikelyMutatingCommand()`

This file contains most of the heuristics that define what the journal considers "work".

### `change-unit-tracker.ts`

This file decides when a change unit should open or close.

Current behavior:

- if there is no current change unit, a mutating event opens one
- `session_shutdown` closes the current change unit
- a new prompt closes the current change unit when the current one already contains mutations and the prompt text changed

This is intentionally small. It expresses boundary policy, not storage or summarization.

### `git-snapshot.ts`

This file captures repository state from Git.

It:

- discovers the repo root
- reads the current branch
- reads changed files from `git status --porcelain`
- reads line stats from `git diff --numstat` and `git diff --cached --numstat`
- merges those sources into one `GitSnapshot`

Snapshots are taken only when the ingestion layer decides they are needed, currently after successful mutating tool results.

## Flow through the capture subsystem

The high-level flow is:

1. Pi emits an event.
2. `extension.ts` receives it.
3. `extension.ts` passes it to `EventIngestionService`.
4. `EventIngestionService` calls `normalizeEvent()` from `event-normalizer.ts`.
5. `ChangeUnitService` uses `ChangeUnitTracker` from `change-unit-tracker.ts` to decide whether to open or close a change unit.
6. If the event represents a successful mutation, `captureGitSnapshot()` may capture Git state.
7. The rest of the system stores events, updates change units, and may create an artifact when a unit closes.

So `capture/` is mainly about classification and boundaries.

## What belongs here vs in `core/`

Put logic in `capture/` when it answers questions like:

- What kind of event is this?
- Is this event meaningful?
- Is this event mutating?
- Does this event start or end a work unit?
- What does Git currently say changed?

Put logic in `core/` when it answers questions like:

- How is data stored?
- How are change units persisted and updated?
- How are artifacts generated?
- How do repositories query or mutate journal state?

## Limits of independence

This folder is conceptually understandable on its own, but not fully independent in implementation terms.

Examples:

- `extension.ts` depends on `config`, `core/services`, and `ui`
- all capture files depend on shared `types`
- snapshot capture is triggered by the ingestion service in `core/`

So you can understand the intent of capture in isolation, but the full runtime behavior still depends on `core/`.

## Suggested reading order

1. `extension.ts`
2. `event-normalizer.ts`
3. `change-unit-tracker.ts`
4. `git-snapshot.ts`

Then move to:

- `src/core/services/event-ingestion-service.ts`
- `src/core/services/change-unit-service.ts`

Those two files show how capture decisions affect persisted journal state.
