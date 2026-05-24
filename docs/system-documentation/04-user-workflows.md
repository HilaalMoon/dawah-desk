# 04. User Workflows

## Home
Purpose:
- show active case tabs
- provide quick navigation into current work
- keep the global active-case bar and search available

Current behavior:
- the sticky top bar is labeled `Open Cases`
- clicking an open case from another page should return directly to that case in the workspace
- `Most Frequently Used Sources` opens a source-details modal with copy actions for source text, translation, and tafsir when present
- `Library Snapshot` includes the primary `New Case` action
- `Most Frequently Used Cases` surfaces the most-opened saved cases

## Quick AIssist
Purpose:
- provide a very lightweight text-only utility chat inside the app
- let the user ask quick model questions without leaving Da'wah Desk

Current behavior:
- one temporary conversation only
- no saved chat history
- no multiple threads
- no file or non-text upload
- uses the current global active-model picker selection
- replies can be copied
- clearing the conversation removes the current thread from the UI
- if the active backend/model call fails, the app surfaces the real error instead of silently falling back to mock output

Important boundary:
- `Quick AIssist` is intentionally outside the case/source/traceability workflow
- it should not be treated as a source-managed or confidence-reviewed drafting surface

## New Case
Purpose:
- collect the question and light context
- run suggested classification
- show similar-case preview before entering the workspace

Current flow:
1. User enters question and context.
2. User clicks `Suggest Classification`.
3. AI suggests topic, audience, question type, difficulty, and likely intent, normalized to the fixed settings-managed lists.
4. Similar cases are shown at the bottom.
5. User can open a similar existing case instead of creating a new one.
6. Or user opens the new case in the workspace.

## Workspace
Purpose:
- research
- assemble support
- draft bites
- maintain confidence and traceability

Main panels:
- case context / cataloging
- similar cases
- source panel
- response builder
- confidence/support panel

Important rules:
- sources come from the saved source library
- translation is user-invoked
- multiple short bites are allowed and encouraged
- support status should stay visible and editable
- save and update happen directly from the workspace instead of going through a separate confirmation page
- unsaved workspace changes should warn before navigation away
- each bite now includes an unlabeled conversation-use checkbox in the action column
- checking that box marks the bite visually and is auto-persisted for saved cases without triggering an unsaved-case warning

### Suggest Structure
Current AI structure generation is intentionally lean:
- it sends the case question
- it sends the case topic when available
- it sends the optional context note when present
- it does not send person name
- it does not send platform
- it does not send selected source IDs

Reason:
- keep token usage lower
- reduce prompt clutter
- avoid confusing the model with source identifiers that do not contain meaningful source text
- still give the model one useful classification anchor through the selected case topic

Current limitation:
- structure generation is still question-topic-context driven, not grounded in full source excerpts

## Sources
Purpose:
- manage connectors
- retrieve live connector content
- add manual sources
- maintain the saved source library

Current intended order on the page:
1. connector management
2. live retrieval
3. add manual source
4. saved source library

Important rule:
- the workspace does not perform broad live retrieval directly
- `Retrieve From Connector` and `Add Manual Source` are intentionally collapsed by default for denser production use

## Saved Source Library
Purpose:
- act as the curated source pool available to workspace drafting
- hold both connector-derived and manual records

Current behavior:
- filter by text
- filter by source type
- filter by connector/manual origin
- review sources in a modal before or after save

## Translation
Translation remains optional and user-invoked.

### Quran-derived content
- translation comes from the source record itself
- clicking translation copies the stored translation
- no AI translation modal is opened for Quran source translation

### Sunnah-derived content with stored translation
- saved Sunnah records that contain Arabic plus English behave like Quran records in the workspace
- clicking translation uses the stored translation directly instead of opening the translation module

### AI translation modal
- translation is user-invoked
- the modal opens immediately and stays idle until the user presses `Translate` or `Reword`
- target language is free text and defaults to English when blank
- the source panel is labeled `Original Text`
- the modal now uses a single output area instead of a duplicate comparison pane
- the user can copy the translated or reworded result directly from the modal
- translation uses the currently selected active AI model
- if the requested target language is the same as the original language, the AI is instructed to reword instead of translating
- if AI translation fails or times out, the modal stays open and surfaces the real error in place

## Save Review
Purpose:
- confirm case save rather than forcing a heavy manual form

Current behavior:
- save review proposes metadata
- user can confirm or go back
- confirmed saves create or update the case in the library

## Case Library
Purpose:
- browse saved cases
- open case detail
- duplicate/reuse saved material

Current behavior:
- only saved cases appear here
- case cards can expand or collapse for denser browsing
- top-bar live search can jump into case detail from anywhere
- library deletion removes the case from backend persistence as well as local state
- deleting a saved case also removes its related saved bites cleanly
- library filtering now mirrors the denser source-library style more closely

## Similar Cases
Similar case checking exists in two places on purpose:
- in `New Case`, to prevent unnecessary duplicate work before entering the workspace
- in `Workspace`, to support reuse during drafting

This duplication is intentional and should remain unless a clearly better flow is approved.
