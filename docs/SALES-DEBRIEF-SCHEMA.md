# OpenCloser Sales Debrief Schema vNext (Design)

## 1. Current `call_logs` Columns
As of schema v7 (`src-tauri/src/db/schema.rs`), `call_logs` contains the following columns:
- `id` (TEXT PRIMARY KEY)
- `lead_id` (TEXT NOT NULL, FK to leads)
- `provider` (TEXT DEFAULT 'gemini')
- `duration_seconds` (INTEGER DEFAULT 0)
- `transcript` (TEXT DEFAULT '[]')
- `status` (TEXT NOT NULL DEFAULT 'pending')
- `sentiment` (TEXT DEFAULT 'Neutral')
- `objections_handled` (TEXT DEFAULT '[]')
- `emotion_log` (TEXT DEFAULT '[]')
- `created_at` (DATETIME DEFAULT CURRENT_TIMESTAMP)

## 2. Additive vNext Fields / JSON Schema
The following structured fields will be added to support the sales workflow invariants:

```json
{
  "objections": [
    {
      "archetype": "string",
      "quote": "string",
      "addressed": "boolean",
      "product_gap": "boolean"
    }
  ],
  "talk_ratio": "number (0..1)",
  "next_step": {
    "action": "string",
    "date": "string (ISO 8601)",
    "channel": "string"
  },
  "risks": [
    "enum(no_dm | no_next_step | monologue | cooling | dnc)"
  ],
  "followup_draft": {
    "text": "string",
    "status": "enum(draft)"
  },
  "kb_claims_used": [
    {
      "source": "string",
      "updated_at": "string (ISO 8601)"
    }
  ]
}
```

## 3. Computing `talk_ratio` (Heuristic)
Instead of relying on an LLM to determine the talk ratio, we can compute it directly from the transcript JSON without an API call:
- Parse the `transcript` JSON array (which contains `role` and `text`).
- For each message, count the words (or characters) in `text`.
- Sum the word counts for the AI agent (e.g., `role: "model"`) and the prospect (e.g., `role: "user"`).
- `talk_ratio` = `agent_word_count / (agent_word_count + prospect_word_count)`.
This gives a fast, deterministic `0..1` ratio where `> 0.5` indicates the agent spoke more than the prospect.

## 4. Migration Strategy: Avoiding v8 Collision with Hiring
Both the **sales** track and the **hiring** track are independently marching toward schema v8. If we blindly bump `SCHEMA_VERSION` to 8 and add discrete SQL columns for the new debrief data, merging the hiring and sales branches will cause a schema version collision.

**Proposal**: Instead of adding multiple individual columns (which clutters the schema and invites conflicts), we will add a single additive JSON column:
```sql
ALTER TABLE call_logs ADD COLUMN debrief_json TEXT DEFAULT '{}'
```
This isolates the sales-specific structured data. To resolve the `SCHEMA_VERSION` fight entirely, the migration runner should be made idempotent (e.g., `safe_alter` skips if the column exists). Both hiring and sales can use this pattern for their respective JSON columns, meaning they don't overwrite each other's schema shape even if both try to use v8.

## 5. Proving Tests (Test Plan)
To prove the debrief logic, we will write unit tests using fixture transcripts (without needing a live Gemini key):

- **Fixture Transcript 1: Unanswered Objection + Missing Next Step**
  - **Input**: Prospect says "Your competitor offers this for half the price." and the agent immediately says "Well, thanks for your time." without addressing it or booking a next step.
  - **Assertion 1**: The extracted `objections` array contains an object with `archetype: "competitor"`, `addressed: false`.
  - **Assertion 2**: The `risks` array includes `"no_next_step"`.
  - **Assertion 3**: The `next_step` object is missing or null.

- **Fixture Transcript 2: High Agent Talk Ratio (Monologue)**
  - **Input**: Agent sends a 500-word block of text. Prospect replies "Ok."
  - **Assertion**: Heuristic `talk_ratio` calculation returns `> 0.9` and `risks` array includes `"monologue"`.

DONE_OK SALES-DEBRIEF-SCHEMA.md
