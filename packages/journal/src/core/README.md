# Core subsystem

This folder contains the journal package's state-management logic: it defines the SQLite schema, persists normalized events and change units, coordinates ingestion, and generates stored change artifacts from closed units of work.

It is the right place to study when you want to understand how the journal turns capture decisions into durable history.

## Responsibilities

`src/core/` is responsible for:

- creating and migrating the SQLite schema
- providing persistence access for events, change units, snapshots, and artifacts
- coordinating ingestion of normalized events into stored journal state
- opening, updating, and closing change units
- generating artifacts from closed change units
- deriving summary metadata such as work type and artifact status

It is not responsible for listening to raw Pi events or rendering UI output. Those concerns live mostly under `src/capture/` and `src/ui/`.

## Files

### `migrations.ts`

This file defines the database schema.

It creates the tables used by the journal:

- `journal_meta`
- `journal_events`
- `change_units`
- `git_snapshots`
- `artifacts`

It also creates the indexes needed for common lookups such as:

- events by session and time
- events by change unit
- open or recent change units
- latest snapshot per change unit
- recent artifacts

This file is the storage contract for the rest of `core/`.

### `storage.ts`

This file owns the low-level SQLite connection and exposes a small storage facade.

It:

- opens the database
- runs migrations on startup
- exposes the raw database handle to repositories
- inserts and queries artifacts
- inserts and queries Git snapshots
- closes the database

This class is intentionally thin. It is a persistence gateway, not the place for workflow logic.

### `repositories/events-repository.ts`

This repository persists normalized journal events.

It:

- appends normalized events to `journal_events`
- assigns a `change_unit_id` after a change unit is opened or resolved
- lists all events belonging to one change unit

This repository is important because events are written before the change-unit service decides how to associate them.

### `repositories/change-units-repository.ts`

This repository persists change unit records.

It:

- inserts newly opened change units
- updates open or closed change units
- retrieves the current open change unit for a session
- retrieves a change unit by id
- lists recent change units

It stores structured fields such as counters and timestamps, plus JSON-encoded fields such as file paths and metadata.

### `services/event-ingestion-service.ts`

This is the orchestration layer for the core subsystem.

It coordinates the main ingestion workflow:

1. normalize the incoming event
2. persist it
3. ask the change-unit service how journal state should evolve
4. capture a Git snapshot after a successful mutating tool result
5. create and store an artifact when a change unit closes

This is the best file to read first in `core/` because it shows how the whole subsystem works together.

### `services/change-unit-service.ts`

This service owns the lifecycle of change units.

It:

- asks `ChangeUnitTracker` whether to open or close a unit
- opens a new unit when needed
- assigns events to a unit
- updates counters, file paths, prompt information, and derived metadata
- attaches snapshots to a unit
- closes units and returns the full data needed for artifact creation

This is where boundary decisions from `capture/` become persistent state transitions.

### `services/artifact-service.ts`

This service creates stored artifacts for closed change units.

It:

- delegates summarization to `ChangeSummarizer`
- stores the resulting artifact

It is intentionally small because the summarization policy lives in the summarizer.

### `summarization/change-summarizer.ts`

This file turns a closed change unit plus its events and latest snapshot into a user-facing artifact.

It derives:

- artifact title
- artifact summary
- artifact body
- artifact status
- deduplicated file paths
- deduplicated validations
- work type classification

It also exports `determineWorkType()`, which is used earlier by the change-unit service while a unit is still open.

## Flow through the core subsystem

The high-level flow is:

1. `EventIngestionService` receives a raw Pi event from `capture/extension.ts`.
2. It normalizes the event using `capture/event-normalizer.ts`.
3. `EventsRepository` stores the normalized event in `journal_events`.
4. `ChangeUnitService` asks `ChangeUnitTracker` whether the current change unit should open, close, or stay active.
5. If a change unit is active, `ChangeUnitService` assigns the event to it and updates derived state.
6. If the normalized event is a successful mutating tool result, `capture/git-snapshot.ts` may produce a `GitSnapshot`, which is stored and linked to the change unit.
7. If a change unit closes, `ArtifactService` uses `ChangeSummarizer` to create a durable artifact and stores it.

So `core/` is mainly about persistence, coordination, and derivation.

## What belongs here vs in `capture/`

Put logic in `core/` when it answers questions like:

- How is journal data stored?
- How does an event update persistent state?
- How are change units materialized and updated?
- When a unit closes, how is an artifact generated and stored?
- How do repositories query previous journal state?

Put logic in `capture/` when it answers questions like:

- What kind of event is this?
- Is this event mutating or meaningful?
- Should this event open or close a work unit?
- What does Git currently say changed?

A useful rule of thumb is:

- `capture/` classifies and detects
- `core/` stores, coordinates, and summarizes

## Limits of independence

This folder is conceptually understandable on its own, but not fully independent in implementation terms.

Examples:

- `event-ingestion-service.ts` depends on `capture/event-normalizer.ts` and `capture/git-snapshot.ts`
- `change-unit-service.ts` depends on `capture/change-unit-tracker.ts`
- summarization depends on shared journal types
- artifacts are later consumed by `src/ui/`

So you can understand the journal's persistence model in isolation, but the full runtime still depends on capture and UI integration.

## Suggested reading order

1. `services/event-ingestion-service.ts`
2. `services/change-unit-service.ts`
3. `repositories/events-repository.ts`
4. `repositories/change-units-repository.ts`
5. `summarization/change-summarizer.ts`
6. `services/artifact-service.ts`
7. `storage.ts`
8. `migrations.ts`

That order starts with workflow, then moves down into persistence and schema details.
