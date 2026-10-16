# 0016 rebuild keeps existing rows (one-off proof, 17 Oct)

`0016_program.sql` widens the `controls` group list and the `requirements`
cadence list by rebuilding both tables inside the migration transaction
(`PRAGMA defer_foreign_keys`, stash, drop, recreate, reinsert). Proof through the
same path `rer setup` uses locally, `wrangler d1 migrations apply --local`:

1. Applied 0001–0015 to an empty local D1.
2. Inserted r1-era rows: an owner, two controls, two requirements, two exhibits,
   two receipts (one superseding the other) and a review folder selecting a control.
3. Exported `controls`, `requirements`, `exhibits`, `receipts` and
   `review_folder_controls`, then applied 0016–0022.

Result:

```
controls identical (2 rows)
requirements identical (2 rows)
exhibits identical (2 rows)
receipts identical (2 rows)
review_folder_controls identical (1 rows)
PRAGMA foreign_key_check -> []
requirements accepts cadence 'annual'
an orphan requirement (control_id 'nope') is still refused by its foreign key
```

The receipt immutability triggers are on `receipts`, which the migration does not
touch. The browser journeys (`tests/browser.mjs`, `tests/review-browser.mjs`) apply
all migrations through `rer setup` in a disposable checkout and pass.
