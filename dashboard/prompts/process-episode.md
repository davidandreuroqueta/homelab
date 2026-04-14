# Process Podcast Episode into Drafts

Generate 3 LinkedIn post drafts based on a podcast episode David marked as interesting.

## Inputs

**Episode title**: {{episodeTitle}}
**Episode transcript**:
{{transcript}}

**Voice profile**:
Read `{{voiceProfilePath}}`

**Recent published posts**:
Query SQLite at `{{dbPath}}`:
```sql
SELECT content FROM published ORDER BY published_at DESC LIMIT 10;
```

## Write 3 drafts

1. **Key insight** — David's personal reflection on the most impactful idea from the episode
2. **Contrarian angle** — a take that challenges or complicates a point from the episode
3. **Practical takeaway** — an actionable or applied angle (especially useful if there's a finance-AI connection)

All drafts must apply the voice profile, stay under 2800 chars, and reference
the episode in sources.

## Output

Run ID: {{runId}}
Batch ID: {{batchId}}
Episode ID: {{episodeId}}

Insert into SQLite at `{{dbPath}}`:

```sql
INSERT INTO drafts (batch_id, run_id, topic, angle, is_star_post, content, hook, sources, status)
VALUES ('{{batchId}}', {{runId}}, '<topic>', '<angle>', 0, '<content>', '<hook>',
'[{"type":"episode","url":"<audioUrl>","title":"{{episodeTitle}}"}]', 'pending');
```

Then:
```sql
UPDATE episodes SET status='drafted' WHERE id={{episodeId}};
UPDATE generation_runs SET status='success', drafts_generated_count=3, duration_ms=<elapsed>
WHERE id={{runId}};
```

Print final JSON: `{"runId": {{runId}}, "episodeId": {{episodeId}}, "draftIds": [...]}`.
