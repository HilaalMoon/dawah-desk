# 03. Data Model And State

## Core Entities

### CaseRecord
Defined in [`src/types/index.ts`](../../src/types/index.ts).

Represents one da'wah case.

Important fields:
- `caseId`
- `title`
- `originalQuestion`
- `contextNote`
- `personName`
- `platform`
- `topic`
- `audienceType`
- `questionType`
- `difficulty`
- `likelyIntent`
- `status`
- `accessCount`
- `sourceIdsUsed`
- `responseBiteIds`
- `confidenceStatus`

### ResponseBite
Represents one logical answer bite in a case.

Important fields:
- `biteId`
- `caseId`
- `biteOrder`
- `biteTitle`
- `biteText`
- `sourceCategory`
- `sourceLinks`
- `supportStatus`
- `supportStatusManuallySet`
- `aiAssisted`
- `translationUsed`
- `usedInConversation`

Structured Quran-like bites may also include:
- `structuredSourceLayout`
- `sourcePrimaryText`
- `sourceSecondaryText`
- `translationResourceName`
- `sourceTafsirText`
- `tafsirResourceName`

### SourceItem
Represents one reusable source record in the saved source library.

Important fields:
- `sourceId`
- `sourceType`
- `sourceTitle`
- `topic`
- `sourceLanguage`
- `excerpt`
- `fullReference`
- `trustLevel`
- `translationAvailable`
- `authenticatedTranslation`
- `translationResourceId`
- `translationResourceName`
- `tafsirText`
- `tafsirResourceId`
- `tafsirResourceName`
- `tafsirLanguageName`
- `accessCount`
- `linkedBiteIds`
- `sourceOrigin`
- `connectorId`
- `connectorName`

## Source Types
Current source types:
- `quran`
- `hadith`
- `scholarly-note`
- `user-note`
- `article`
- `saved-bite`

Current practical use in V1:
- `quran`
- `hadith`
- `scholarly-note`
- `user-note`

## Support Status Model
Support status is separate from source type.

Current values:
- `direct-source`
- `translated-source`
- `ai-assisted`
- `weak-support`
- `missing-support`

Important rule:
- manual user correction of support status should not be overwritten by automated review

## Source Library Model
The saved source library is now the canonical source pool for workspace source selection.

Important behavior:
- live retrieval happens in `Sources`
- workspace source search only searches saved library records

## Saved Vs Unsaved Cases
Case status matters:
- unsaved or in-progress cases can exist in active tabs and workspace
- only saved cases belong in the `Case Library`

Editing a workspace case updates local working state immediately, but `Save Case` or `Update Saved Case` is still required to persist the case back into the library/backend saved state.

## Shared Runtime Protection
For multi-account use across a shared OneDrive folder, the backend runtime layer now protects shared data in three ways:
- `server/data/runtime-state.json` remains the main materialized snapshot
- `server/data/ops` stores append-only case/source save and delete operations
- `server/data/backups` stores prior snapshot backups

Important behavior:
- saved cases, saved bites, and saved sources are reconstructed from the snapshot plus the operation log
- this reduces accidental overwrite when two Windows accounts save from slightly different OneDrive sync states
- if the snapshot becomes unreadable, the backend falls back to the newest readable backup before replaying operations

Exception:
- `usedInConversation` on a workspace bite is treated as lightweight activity tracking
- toggling that checkbox does not mark the case as unsaved
- for already saved cases, that checkbox state is persisted automatically in the background

## Manual Source Splitting
Manual sources with blank-line-separated paragraphs are stored as one source, but when added to the workspace they split into multiple bites.

Example:
- a 5-paragraph manual source becomes:
  - `Source Title (1/5)`
  - `Source Title (2/5)`
  - `Source Title (3/5)`
  - `Source Title (4/5)`
  - `Source Title (5/5)`

All of those bites remain linked to the same underlying source record.

## Topics
Topics are centrally managed through Settings and consumed by:
- source metadata
- new case topic selection
- workspace cataloging

The allowed list is part of backend settings and can also be extended from the Sources page.

The other classification lists are also centrally managed through Settings:
- `audienceTypeList`
- `questionTypeList`
- `difficultyList`
- `likelyIntentList`

AI classification output is normalized onto these managed lists before being shown to the user or stored on a case.

## Runtime State Risks To Know
### Local-only data
If something only exists in local state and is never saved, it may not be recoverable after resets.

### Recovered source records
Some saved sources may be reconstructed from saved bites if older versions failed to persist source records directly. This recovery preserves usefulness, but reconstructed records may have less original metadata than directly persisted ones.

### Bite ID normalization
Saved/workspace bites are now normalized to keep bite IDs unique per case.

Important behavior:
- new bites use unique generated IDs instead of order-derived IDs
- duplicate bite IDs are repaired during backend bootstrap and frontend hydration
- this prevents UI collisions such as two bites expanding together because they shared the same `biteId`
