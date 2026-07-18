# User-visible improvements (Next.js app)

Here's the list, filtered hard: only things a non-technical person searching bibliographic records would actually notice, phrased the way they'd experience them. (Everything lands automatically when the app upgrades to 0.4.0, except the last section.)

## Searches that used to show an error and now just work

- **Typing `%`, `*`, or certain punctuation in full-text search mode** — searches like `100%`, `*69`, or a stray dash used to produce an error message instead of results. They now return sensible matches (`100%` finds records containing "100%").
- **Emoji or symbol-only searches** in full-text mode — previously an error; now simply return no matches.
- **Deeply nested advanced searches** — building an advanced search with groups inside groups (3+ levels, e.g. "(author is X AND year > Y) OR (department is Z AND …)") could fail outright. Now works at any depth. *(Whether your users ever hit this depends on how the app sends requests — worth a quick check, but it's covered either way now.)*
- **An empty advanced-search group** (adding a filter group but not filling it in) no longer errors.
- **Invisible characters** pasted in from other documents (null characters, common in copy-paste from some sources) no longer error.

## Searches that used to quietly give wrong results

- **Trailing spaces**: searching `"kafka "` (with spaces at the end, easy to do when copy-pasting) could silently find nothing. Spaces are now fully trimmed on both ends.
- **A half-filled advanced search filter** could silently match *every* record — the user sees a full result list and assumes their filter worked. It now reports an error instead of lying.

## The diacritics story — since they care most about this

**What's solid now:** a user typing `é` on a Mac keyboard and a record whose `é` was stored differently under the hood (composed vs. decomposed Unicode — same glyph, different bytes) will match. This session made that guarantee *tested* — including through the full-text mode — where before it was untested and partially broken in edge cases (accented terms combined with `%`/`_`).

**One thing to verify in the app's database — this is the important action item:** the matching guarantee assumes the database stores its text in decomposed (NFD) form. We discovered this session that the library's own test database *wasn't*, and every accented search silently failed against it — no error, just mysteriously missing results. If the work database has the same issue, your users' accented searches (`Müller`, `José`, `Δημήτρης`) may be quietly failing *today*. It's a one-time normalization pass to check and fix, and it's invisible to users except that accented searches start working.

**What still doesn't work — honest limitations to communicate:**
- In **normal search mode**, case-insensitivity is ASCII-only: `kafka` finds `Kafka`, but `égalité` does **not** find `Égalité`, and lowercase Greek won't find uppercase Greek.
- Accent-*insensitive* search (typing `cafe` to find `café`) doesn't exist in normal mode.
- **Full-text mode is actually better at both** (assuming a standard FTS5 setup): it case-folds all of Unicode (Greek included) and, with default settings, strips Latin diacritics — so `cafe` *does* find `café` there. If diacritics are your users' top concern, steering their searches toward full-text mode — or making it the default — is the single most user-visible lever you have.

## Faster searches — needs a small app change (not just the upgrade)

With the ~10-line `fusedQuery` wiring plus caching the total-record count, typical searches do roughly a third of the database work — on a large table that's the difference users describe as "it feels faster" on every search they run. Until that edit is made in the app repo, upgrade alone doesn't change speed.

---

The NFD verification of the work database is the item I'd act on first — it's the only one on the list where users may be losing search results *right now*.

## TLDR;

- Upgrading to 0.4.0 automatically fixes several user-facing errors: `%`/`*`/punctuation and emoji searches in full-text mode, deeply nested advanced searches, empty advanced-search groups, and pasted invisible characters.
- Two silent-wrong-results bugs fixed: trailing spaces finding nothing, and half-filled advanced filters matching everything.
- Composed-vs-decomposed accent matching (typing `é` finds stored `é`) is now guaranteed and tested — in both search modes.
- **Action item:** verify the work database stores text in NFD form — if not, accented searches (`Müller`, `José`, `Δημήτρης`) may be silently failing for users *today*; a one-time normalization pass fixes it.
- Still limited: normal search mode is case-insensitive for ASCII only (`égalité` ≠ `Égalité`) and never accent-insensitive (`cafe` ≠ `café`).
- Full-text mode handles both better (Unicode case folding + Latin diacritic stripping) — steering users toward it is the biggest diacritics win available.
- Search speed: unchanged by the upgrade alone; a ~10-line app change (`fusedQuery` + count caching) cuts typical search work to roughly a third.
