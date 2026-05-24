# 01. Product And Scope

## Product Identity
Da'wah Desk is a desktop-first productivity workspace for Muslim da'ees.

It is:
- case-based
- confidence-first
- source-traceable
- library-first before deep search
- designed for human validation of trust-sensitive work

It is not:
- a generic chatbot
- a fatwa bot
- a single-window conversation UI
- a system that treats all content as equally trustworthy

## Non-Negotiable Product Rules
These rules should remain true unless the product owner explicitly changes them.

1. Confidence is the primary value; speed serves confidence.
2. The app is case-based, not file-based.
3. Similar saved cases must be checked before deep source search.
4. Translation is optional and user-invoked only.
5. Saved outputs are English only.
6. Responses may be split into multiple short logical bites.
7. Sources, translations, AI summaries, and weak-support content must remain visually distinct.
8. AI proposes; the human validates where trust matters.
9. The app should not collapse into a chatbot-first experience.
10. Clear traceability between response bites and source support must be preserved.

## Current Production Baseline
The current baseline is a working V1 with:
- case creation
- case classification assistance
- similar-case preview in new case flow and workspace
- workspace drafting with response bites
- saved source library
- manual source creation
- connector-based Quran retrieval
- approved-domain fallback retrieval for Quran.com and Sunnah.com
- Sunnah retrieval with Arabic plus stored English translation
- optional tafsir and translation attachment on Quran sources
- case library and reuse flow
- immediate save / update from the workspace
- backend-assisted persistence and recovery
- Vertex AI as the default AI model for AI-assisted features
- AI-based translation on user request
- a lightweight `Quick AIssist` utility chat for text-only model queries

## Current High-Level Areas
- `Home`
- `New Case`
- `Workspace`
- `Case Library`
- `Sources`
- `Quick AIssist`
- `Settings`

## Current Home Priorities
The Home screen now emphasizes:
- `Open Cases` in the sticky top bar
- `Most Frequently Used Sources`
- `Library Snapshot`
- `Most Frequently Used Cases`

This is intentional. Home is now a usage and re-entry surface, not a feature tour or starter-template page.

## What Must Stay Human-Controlled
- final support judgment on important bites
- whether to save or reuse a case
- whether to add translated material
- whether a source should be trusted enough to save
- source metadata where provenance matters

## Trust Model
The app distinguishes between:
- direct-source support
- translated support
- AI-assisted content
- weak support
- missing support

This distinction must remain visible in the UI and in stored data.

## Source Philosophy
The workspace does not perform broad live source retrieval directly.

Current intended separation:
- `Sources` is for retrieval, review, metadata, and saving
- `Workspace` is for using saved sources during case drafting

This separation is deliberate and should not be removed lightly.
