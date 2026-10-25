# Why shared tag relations are sparse — 2026-10-15

Question: `/tag/柯文哲/` shows only 「政治人物」. Are admin review and the data sources working?

## Where public relations come from

`app/src/tag-groups/semantic.ts` (served by `/api/v1/tags/<tag>/relations`):

1. **is-a** from `tag_group_members`, only rows with status `auto` or `confirmed`, only groups with `kind='group'`
   (topic/section groups such as 「政治」 are not relations), plus parent groups.
2. **related / alias / is-a** from `tag_submissions` with `kind='relation'` and `status='approved'`.

## What the production DB holds (read-only queries, 10/15 18:15 Taipei)

- `tag_submissions`: **0 rows**, `tag_submission_log`: 0 rows. Nobody has submitted a relation or picture through the new
  form yet, so no related/alias edge can exist.
- `tag_group_members`: 28,518 rows. Status `review` (waiting for an admin, never shown publicly): **1,359** —
  AI 1,123, legacy 187, Wikidata 32, person 17. Biggest groups waiting: 議題 272, 現任立委 96, 公司廠商 89.
- Last admin review of a non-legacy membership: **2026-10-11 08:59** (32 reviewed in total). `tag_group_member_log` is empty.
- The daily `tag-groups` job (worker, 04:55) keeps adding rows: 10/12, 10/13 and 10/14 each added 200–650 memberships
  (section/person/Wikidata `auto`, AI `review`).
- 柯文哲 has three memberships: 政治人物 (legacy, confirmed — shown), 現任縣市長 (legacy, **review** — correctly not shown,
  he is no longer mayor and an admin should reject it), 政治 (topic kind — not a relation by design).
- The legacy group set has no 台灣民眾黨 group, so party membership cannot appear for 柯文哲, 黃國昌 and others.

## Conclusion

The data sources and the public projection work as designed. Relations are sparse because (1) no reader or admin has
used the submission form yet and (2) 1,359 suggested memberships have waited in the admin review queue since 10/11.
Both need human action, not code:

- An admin works through `/admin/tags/?view=groups` (memberships) and `/admin/tags/?view=relations` (submissions).
- Creating a 台灣民眾黨 group (and similar missing parties) is an editorial decision for the owner.

The end-to-end submit → review flow with the owner's existing admin session is tracked in the UI ledger (item 3).
