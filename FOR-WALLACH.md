# User-visible improvements (Next.js app)

Only things a non-technical person searching the records would actually notice, phrased the way they'd experience them. Everything below arrives with the next app update — no action needed from users.

*(Every claim here was checked against the actual app and its actual database — the ~448,000-record objects table — not just the search library on its own. Record counts are from that database.)*

## Searches that used to show an error and now just work

- **Typing `%`, `*`, `&` or certain punctuation in the *Enhanced* search modes** — searches like `100%`, `*69`, `R&B` or `u.s.a.` currently produce the *"There's a syntax error in your enhanced search!"* message. An enhanced search for `100%` now returns its 1,889 matching records, and `R&B` its 58, instead of that error.
- **A stray search operator or bracket in Enhanced modes** — `kafka OR` with nothing after it, or a parenthesis that was never closed, used to be the same error. The stray word or bracket is now simply searched for like any other text.
- **Emoji or symbol-only searches** in Enhanced modes — previously the same error; now simply return no matches.
- **An empty advanced-search group** (adding a filter group but not filling it in) no longer errors.
- **Invisible characters** pasted in from other documents (null characters, common in copy-paste from some sources) no longer error.

## Searches that used to quietly give wrong results

- **Trailing spaces**: searching `"kafka "` (with spaces at the end, easy to do when copy-pasting) could silently find nothing. Spaces are now fully trimmed on both ends.
- **A half-filled advanced search filter** could silently match *every* record — the user sees a full result list and assumes their filter worked. It now reports an error instead of lying.
- **Names with apostrophes in Enhanced modes**: `o'keeffe` found nothing, because the apostrophe was being deleted and the resulting word exists in no record. It now finds all 11 O'Keeffe records.
- **Hyphenated names in Enhanced modes** are now matched as a unit: `jean-paul` finds *Jean-Paul* (53 records) rather than any record that happens to contain both *Jean* and *Paul* somewhere (77).

## Enhanced search: the power-user syntax still works

None of this is new — the Enhanced modes have always understood it — but it was never written down anywhere, and the crash fixes above were done in a way that keeps it. The capital letters matter: lowercase `or` and `not` are just ordinary words to search for.

| Type | To find |
| --- | --- |
| `kaf*` | words *starting with* kaf (Kafka, Kafkaesque, …) |
| `kafka OR proust` | records mentioning either |
| `kafka NOT prague` | records mentioning the first but not the second |
| `"new york"` | that exact phrase — the words next to each other, in that order |
| `Title:kafka` | kafka in that one field only. Write the field name with underscores: `Display_Name:goya` |
| `(kafka OR proust) AND prague` | grouping |

Only the fields covered by the chosen Enhanced mode can be used before the colon; any other field gives the existing *"not included in the enhanced search modes"* message, as it always has.

## The diacritics story

**Good news, verified: accented searches work correctly today.** An earlier version of this document warned that the database might store accented text in a form that silently breaks accented searches. It was checked directly (~900,000 values across all the searchable tables): the database stores everything correctly, so a user typing `é`, `Müller`, `José`, or `Δημήτρης` matches the records they expect. No action was ever needed.

**Honest limitations that remain (unchanged, but worth knowing):**
- In **Classic search**, case-insensitivity only covers unaccented Latin letters: `kafka` finds `Kafka`, but `égalité` does **not** find `Égalité`, and lowercase Greek won't find uppercase Greek.
- Accent-*insensitive* search (typing `cafe` to find `café`) doesn't exist in Classic mode.
- The **Enhanced modes are better at both** — and this is confirmed for this app's actual configuration: they match across upper/lowercase in all alphabets (Greek included) and ignore accents on Latin letters, so `cafe` *does* find `café` there. If diacritics matter most to your users, the Enhanced modes are the ones to steer them toward.

## Corrections to earlier versions of this list

- **The "roughly 2× faster" promise is retracted.** That change was measured against the real database before shipping. It did speed up narrow searches, but it made the most common action — opening the table, or paging through it with no search typed — about 25 times slower. So it was not shipped. Search speed is exactly what it was before: not better, not worse.
- The NFD/accented-search warning turned out to be a non-issue — the database was verified correct (kept here so nobody chases it).
- An earlier bullet about "deeply nested advanced searches crashing" doesn't apply to this app: it sends requests in a format that was never affected. (The fix exists in the library regardless, as insurance.)
- An earlier bullet described a clearer message for an "unrecognized search mode". That app-side change was not made; it isn't something users can trigger from the interface anyway.

## TLDR;

- The update fixes the *"syntax error in your enhanced search"* message users hit today when searching things like `100%`, `*69`, `R&B`, punctuation, emoji, or a stray `OR` — verified against the real database (`100%` now finds its 1,889 records).
- Two silent-wrong-results bugs fixed everywhere: trailing spaces finding nothing, and half-filled advanced filters matching everything. Two more in Enhanced modes: apostrophes (`o'keeffe` now finds O'Keeffe) and hyphenated names (`jean-paul` matches the name, not two scattered words).
- The Enhanced-mode search syntax (`kaf*`, `OR`, `NOT`, `"exact phrase"`, `Field:term`) still works, and is now written down above.
- **Search speed is unchanged.** The earlier "2× faster" claim is retracted: tested, found to slow down the most common case, not shipped.
- Diacritics: **the database was verified correct** — accented searches (`Müller`, `José`, `Δημήτρης`) already work. Still limited in Classic mode: case-insensitivity is ASCII-only (`égalité` ≠ `Égalité`) and never accent-insensitive (`cafe` ≠ `café`). The Enhanced modes handle both — steer diacritics-sensitive users there.
- Everything arrives with the next app update; users don't need to do anything.
