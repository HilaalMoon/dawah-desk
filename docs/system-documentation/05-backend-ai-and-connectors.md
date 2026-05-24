# 05. Backend, AI, And Connectors

## Backend Purpose
The backend is a lightweight orchestration layer, not a large separate platform.

It currently handles:
- runtime settings
- connector management
- source retrieval
- source persistence
- case persistence
- AI provider management
- lightweight utility chat requests
- AI-only translation requests
- startup bootstrap recovery

## Current Backend Port
Default backend port:
- `8788`

Frontend dev port:
- currently configured through Vite and local launcher

## AI Responsibilities
Current AI-assisted features:
- new case classification
- similar-case assistance
- response structure suggestion
- metadata suggestion
- Quick AIssist text responses
- AI-based translation and rewording

Current default AI provider:
- Vertex AI (Gemini on Vertex)

Current configured Vertex model options:
- `gemini-2.5-flash`
- `gemini-2.5-pro`
- `gemini-3-flash-preview`
- `gemini-3-pro-preview`

Current migration posture:
- Gemini 2.5 and Gemini 3 Vertex models are both available in the app at the same time
- this allows side-by-side testing before legacy model removal
- Gemini 3 preview models may appear in the picker even if the current Vertex project does not yet have access to them

Current translation behavior:
- Quran translation comes from Quran retrieval resources, not from AI
- saved Sunnah translations are reused directly when already attached to a source
- the translation modal opens first and only sends an AI request when the user clicks `Translate` or `Reword`
- translation uses the currently selected active AI model
- same-language requests are treated as rewording, based on AI language detection from the source text itself
- translation errors are surfaced directly in the modal instead of falling back to another service

## Suggest Structure Payload
Current `Suggest Structure` requests are intentionally minimal.

The live AI payload includes:
- question
- topic when present on the case
- optional context note

The live AI payload does not include:
- person name
- platform
- selected source IDs
- full source text
- existing bite content

This keeps token usage lower and avoids sending weak identifiers that do not materially help structure generation.

## AI Provider Layer
The provider system is managed through:
- [`server/ai/service.js`](../../server/ai/service.js)
- [`server/ai/registry.js`](../../server/ai/registry.js)
- adapters in [`server/ai/adapters`](../../server/ai/adapters)

Current provider modes:
- mock local AI
- OpenAI-compatible
- Gemini through configured provider path
- Vertex AI through service-account authentication

## Connectors
Current connector direction:
- Quran connector is the main live external connector currently in use
- hadith connectors are scaffolded but not yet fully wired to real external services
- manual sources are first-class and do not depend on connectors
- approved-domain fallback adapters are available for controlled web retrieval

Current credential configuration per connector:
- `conn-quran-primary` — no `apiKeyRef` or `clientIdHint`; QF credentials are bundled server-side in `server/config/quran-credentials.json` and are not part of the env var credential system
- `conn-hadith-en` — scaffolded placeholder; `apiKeyRef` cleared; not yet wired to a real service
- `conn-hadith-ar` — scaffolded placeholder; `apiKeyRef` cleared; not yet wired to a real service

## Quran Connector
QF credential handling:
- Quran Foundation OAuth2 credentials (client ID and secret) are bundled in `server/config/quran-credentials.json`
- users never enter or manage QF credentials — they are invisible to the credential system
- QF credentials do not appear in `DawahDeskData/credentials.json` or the Secrets panel in Settings
- `conn-quran-primary` carries no `apiKeyRef` field in its connector record

Current Quran integration supports:
- verse retrieval
- range retrieval
- chapter retrieval
- explicit surah-name retrieval when query starts with `surah`, `chapter`, or `سورة`
- translation resource selection
- optional tafsir resource selection
- broader Arabic term matching for prefixed forms during verse search

Saved Quran sources may include:
- Arabic source text
- selected translation
- selected tafsir

## Sunnah Retrieval
Current approved fallback retrieval for `Sunnah.com` supports:
- retrieval from actual hadith pages instead of result snippets
- Arabic as the main source text when available
- English as stored translation
- reuse of stored translation in the workspace, similar to Quran-derived records

## Approved-Domain Web Fallback
The app now supports a controlled approved-domain fallback path instead of generic web scraping.

Current approved adapters:
- `Quran.com`
- `Sunnah.com`

Current controls that are now live:
- `Allow web fallback`
- `Fallback domain allowlist`
- `Caching enabled`
- `Source timeout (ms)`
- `Translation timeout (ms)`

Fallback results should remain visibly marked in the Sources UI as approved fallback results, not primary connector results.

## Source Persistence
Current save path:
- source is saved in frontend store
- source is also posted to backend runtime state

Current delete path:
- source is removed from frontend store
- source is also deleted from backend runtime state

## Bootstrap Recovery
Current bootstrap route:
- `GET /api/state/bootstrap`

Purpose:
- rehydrate saved cases
- rehydrate saved bites
- rehydrate saved sources
- reconstruct missing source records from traceable bite/source links when possible

## Important Integration Caveats
### AI
The system is not yet fully AI-driven in every area. Some behaviors remain heuristic or rule-based.

### Quick AIssist
Quick AIssist is a lightweight utility route, not a traceability-aware case workflow. It returns plain text from the active model and does not persist chat history in backend runtime state.

Current behavior note:
- Quick AIssist no longer silently falls back to mock output when the backend/model request fails
- backend/model errors are surfaced directly so model-access problems can be diagnosed clearly

### Sources
Source metadata quality still depends heavily on user review, especially for manual and scholarly-note entries.

### External APIs
Connector behavior may change depending on provider quotas, billing, or upstream API quality.

## Environment Variables
Local testing has used launcher-based env injection. Long-term recommended production direction:
- move keys out of batch files
- use proper environment variables or secret storage
- rotate exposed test keys after migration
