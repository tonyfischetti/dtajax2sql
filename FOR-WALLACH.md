# User-visible improvements (Next.js app)

Only things a non-technical person searching the records would actually notice, phrased the way they'd experience them. Everything below arrives with the next app update — no action needed from users.

*(This list was originally written from the search library's point of view; it has since been checked against the actual app and its actual database, so the claims below are verified, not theoretical.)*

## Searches that used to show an error and now just work

- **Typing `%`, `*`, or certain punctuation in the *Enhanced* search modes** — searches like `100%` or `*69` currently produce the *"There's a syntax error in your enhanced search!"* message. Verified against the real database: an enhanced search for `100%` now returns its 1,889 matching records instead of that error.
- **Emoji or symbol-only searches** in enhanced modes — previously the same error; now simply return no matches.
- **An empty advanced-search group** (adding a filter group but not filling it in) no longer errors.
- **Invisible characters** pasted in from other documents (null characters, common in copy-paste from some sources) no longer error.

## Searches that used to quietly give wrong results

- **Trailing spaces**: searching `"kafka "` (with spaces at the end, easy to do when copy-pasting) could silently find nothing. Spaces are now fully trimmed on both ends.
- **A half-filled advanced search filter** could silently match *every* record — the user sees a full result list and assumes their filter worked. It now reports an error instead of lying.

## Speed: searches are roughly twice as fast

Every search used to make the database do the same filtering work twice (once for the page of results, once for the result count). It now does it once. On this database (~448,000 records), that saves about an eighth of a second on every Classic-mode search a user runs — the difference between "noticeable pause" and "instant." Enhanced-mode searches benefit too, somewhat less.

## The diacritics story

**Good news, verified: accented searches work correctly today.** An earlier version of this document warned that the database might store accented text in a form that silently breaks accented searches. It was checked directly (~900,000 values across all the searchable tables): the database stores everything correctly, so a user typing `é`, `Müller`, `José`, or `Δημήτρης` matches the records they expect. No action was ever needed.

**Honest limitations that remain (unchanged, but worth knowing):**
- In **Classic search**, case-insensitivity only covers unaccented Latin letters: `kafka` finds `Kafka`, but `égalité` does **not** find `Égalité`, and lowercase Greek won't find uppercase Greek.
- Accent-*insensitive* search (typing `cafe` to find `café`) doesn't exist in Classic mode.
- The **Enhanced modes are better at both** — and this is now confirmed for this app's actual configuration: they match across upper/lowercase in all alphabets (Greek included) and ignore accents on Latin letters, so `cafe` *does* find `café` there. If diacritics matter most to your users, the Enhanced modes are the ones to steer them toward.

## Corrections to the earlier version of this list

- The NFD/accented-search warning above turned out to be a non-issue — the database was verified correct (kept here so nobody chases it).
- An earlier bullet about "deeply nested advanced searches crashing" doesn't apply to this app: it sends requests in a format that was never affected. (The fix exists in the library regardless, as insurance.)
- One small robustness addition from the app-side work: if the app ever receives a request with an unrecognized search mode, it now responds with a clear explanatory message instead of a confusing database error. Users can't normally trigger this from the interface, so it's belt-and-suspenders.

## TLDR;

- The update fixes the *"syntax error in your enhanced search"* message users hit today when searching things like `100%`, `*69`, punctuation, or emoji — verified against the real database (searching `100%` now finds its 1,889 records).
- Two silent-wrong-results bugs fixed: trailing spaces finding nothing, and half-filled advanced filters matching everything.
- Searches are roughly **2× faster** (about an eighth of a second saved on every Classic search on this ~448k-record database).
- Diacritics: **the database was verified correct** — accented searches (`Müller`, `José`, `Δημήτρης`) already work; the earlier warning about this is retracted.
- Still limited in Classic mode: case-insensitivity is ASCII-only (`égalité` ≠ `Égalité`) and never accent-insensitive (`cafe` ≠ `café`).
- The Enhanced modes handle both properly (confirmed for this app's configuration) — steer diacritics-sensitive users there.
- Everything arrives with the next app update; users don't need to do anything.
