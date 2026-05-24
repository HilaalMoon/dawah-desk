# 08. Case Export and Import

Purpose:
- allow users to share curated cases with each other across separate instances of the app
- allow Hatem to distribute prepared cases to users without shipping a full database
- keep each user's library fully independent — no shared IDs, no cross-instance references

---

## Design principle

Export files carry **content only** — no instance-specific IDs travel with the file. When a case is imported, the receiving instance generates its own fresh IDs. This means:

- an exported file is safe to share with anyone running any instance of the app
- importing the same file twice produces two independent cases — no silent overwrite
- there is no concept of "the same case" across instances; identity is per-library, not global

---

## What gets exported

### Included

**Case fields exported:**
- `title`
- `originalQuestion`
- `contextNote`
- `topic`, `audienceType`, `questionType`, `difficulty`, `likelyIntent`
- `platform`, `personName`

**Per bite:**
- `biteOrder`, `biteTitle`, `biteText`, `bitePurpose`
- `sourceCategory`, `supportStatus`, `aiAssisted`, `translationUsed`
- `structuredSourceLayout`, `sourcePrimaryText`, `sourceSecondaryText`
- `translationResourceName`, `sourceTafsirText`, `tafsirResourceName`
- `notes`

**File metadata:**
- `exportedAt` (ISO timestamp of export)
- `exportedBy` (`"Da'wah Desk"`)
- `version` (`1`)

### Excluded

| Field | Reason |
|---|---|
| `caseId` | Instance-specific — meaningless in another library |
| `biteId` | Instance-specific — fresh IDs are generated on import |
| `sourceLinks` | Point to source records in the exporting instance's library; those records do not exist in the recipient's library |
| `relatedCaseIds`, `responseBiteIds`, `sourceIdsUsed` | All relational — referencing other records by ID from the originating instance |
| `accessCount`, `createdDate`, `updatedDate` | Usage stats and timestamps belong to the receiving instance, not the original |
| `confidenceStatus`, `status` | Reset on import — the receiving instance has not reviewed the bites yet |

---

## Two export formats

### JSON export

**When to use:** Sharing a case with another Da'wah Desk user so they can import it into their library.

**How it works:**
- Produces a `.json` file named `{slugified-case-title}.json`
- Contains the full case and all its bites in the Da'wah Desk export format
- Can be imported back into any instance using the Import button in the Case Library

**Slugify rule:** title is lowercased, apostrophes and quotes stripped, non-alphanumeric characters replaced with hyphens, leading and trailing hyphens removed. Example: `"Da'wah about Jesus"` → `dawah-about-jesus.json`.

### CSV export

**When to use:** Reviewing, analysing, or presenting case content in a spreadsheet. Not intended for re-import.

**How it works:**
- Produces a `.csv` file named `{slugified-case-title}-export.csv`
- One row per bite — case context columns are repeated on every row
- UTF-8 with BOM (compatible with Excel on Windows)

**Columns (in order):**
`caseTitle`, `caseQuestion`, `caseTopic`, `caseAudienceType`, `caseQuestionType`, `caseDifficulty`, `caseLikelyIntent`, `biteOrder`, `biteTitle`, `bitePurpose`, `biteText`, `sourceCategory`, `supportStatus`, `supportStatusManuallySet`, `aiAssisted`, `translationUsed`, `usedInConversation`, `sourcePrimaryText`, `sourceSecondaryText`, `sourceSecondaryLabel`, `translationResourceName`, `sourceTafsirText`, `sourceTafsirLabel`, `tafsirResourceName`, `notes`

No instance-specific IDs (`caseId`, `biteId`, `sourceLinks`) appear in the CSV. This matches the workspace CSV export format.

### How to trigger each export

Both formats are available from a dropdown on each case card in the Case Library:
1. Click the **Download icon** on any case card
2. Select **Export as JSON** or **Export as CSV** from the dropdown
3. The file downloads immediately

---

## How the import preview works

When a user selects a `.json` file to import, a preview modal opens before anything is written to the library.

### Validation

The file is rejected immediately (before the modal opens) if:
- it is not valid JSON
- the parsed JSON does not contain `case.title` and `case.originalQuestion`

A plain-text error is shown in the library; the modal does not open.

### Preview phase

The modal shows two sections:

**Section 1 — Imported case details:**
- Title
- Original question
- Context note (if present)
- Topic and difficulty (if present)
- Number of bites

**Section 2 — Cases with the same topic in your library:**

This section gives the user context to make an informed decision before importing.

| Condition | What is shown |
|---|---|
| Imported case has a topic | Cases from your library with the same topic, sorted and badged by title match |
| Imported case has no topic | Amber warning + title-matched list from the full library (exact and close matches only) |
| Same topic exists but no matches found | "No existing cases with this topic found." |

### Title matching

Every case in the relevant list is compared against the imported case title using a three-level match:

| Level | Rule | Badge |
|---|---|---|
| **Exact** | Titles match after lowercasing and stripping all punctuation and extra whitespace | Red — "Exact duplicate" |
| **Close** | One title contains the other, or they share more than 60% of their words (words longer than 3 characters only) | Amber — "Possible duplicate" |
| **None** | Everything else | No badge |

Sort order in the list: exact matches first, close matches second, unmatched cases last.

For no-topic imports: only exact and close matches are shown (no-match cases are filtered out entirely, since the list covers the full library and would otherwise be very long).

### Success phase

After clicking Import case:
- A loading state is shown briefly
- On success: "Case imported successfully." with the case title, and a Close button
- On error: the error message and a Close button

---

## How imported cases are handled

When a case is imported, the backend:

1. Validates the required fields (`case.title`, `case.originalQuestion`)
2. Generates a fresh `caseId`: `case-${Date.now()}`
3. Assigns a fresh `biteId` to each bite via the `normalizeCaseBites` function
4. Sets `sourceLinks: []` on every bite — source records from the originating instance do not exist in the recipient's library
5. Sets `confidenceStatus: "low"` — the receiving user has not reviewed the bites
6. Sets `accessCount: 0`, `createdDate` and `updatedDate` to the import timestamp
7. Sets `status: "saved"`

The imported case is a first-class citizen of the receiving library from the moment it is written. It has no connection to the originating instance.

Bite text content, source text fields (`sourcePrimaryText`, `sourceSecondaryText`, `sourceTafsirText`, translations), and all editorial fields travel intact. The human-written content is preserved; only the instance-specific plumbing is replaced.

---

## JSON file format reference

```json
{
  "exportedAt": "2026-05-23T10:00:00.000Z",
  "exportedBy": "Da'wah Desk",
  "version": 1,
  "case": {
    "title": "Case title",
    "originalQuestion": "The original question text",
    "contextNote": "Optional context about the questioner or setting",
    "topic": "Christianity / Jesus",
    "audienceType": "Christian / Jesus-focused",
    "questionType": "Theological",
    "difficulty": "Medium",
    "likelyIntent": "Seek understanding",
    "platform": "WhatsApp",
    "personName": "John"
  },
  "bites": [
    {
      "biteOrder": 1,
      "biteTitle": "Opening acknowledgment",
      "biteText": "Bite content here.",
      "bitePurpose": "opening",
      "sourceCategory": "user",
      "supportStatus": "strong-support",
      "aiAssisted": false,
      "translationUsed": false,
      "structuredSourceLayout": null,
      "sourcePrimaryText": null,
      "sourceSecondaryText": null,
      "translationResourceName": null,
      "sourceTafsirText": null,
      "tafsirResourceName": null,
      "notes": null
    }
  ]
}
```

All string fields are `null` or omitted when empty. `version` is `1` for all files exported by this version of the app and is reserved for future format changes.

---

## How to share a case with another user

**Exporter (sending the case):**

1. Open the **Case Library** tab
2. Find the case card you want to share
3. Click the **Download icon** on the card to open the export dropdown
4. Select **Export as JSON**
5. The file downloads to your default downloads folder as `{case-title}.json`
6. Send the file to the recipient (email attachment, messaging app, shared folder, etc.)

**Recipient (receiving the case):**

1. Save the `.json` file to any folder on your machine
2. Open the **Case Library** tab
3. Click the **Upload icon** button (top right of the Case Library panel)
4. Select the `.json` file in the file picker
5. The import preview modal opens — review the imported case details
6. Check the "Cases with the same topic in your library" section — if any existing cases are flagged as exact or close duplicates, review them before proceeding
7. Click **Import case** to add it to your library, or **Cancel** to abort
8. The case appears in your library immediately, ready to open in the workspace

The imported case will have low confidence status and no source links. If the case includes structured Qur'an or Sunnah source text in its bites, that content is still present — but the source links that previously connected those bites to your source record library are not restored, because the source records themselves are not part of the export.
