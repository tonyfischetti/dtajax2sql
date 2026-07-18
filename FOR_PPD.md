Free by upgrading the package (no work-app code edits): everything
else from this session. The FT search 500s (100%, *69, bare
punctuation), the NUL-byte crash, deep-nested SearchBuilder healing,
the whitespace/NFD fixes, empty-criteria and no-searchable-columns
guards — all of that is internal to toSQL/toSQLThroughFtTable,
so bumping the dependency version is the entire deployment. Result
gaining a third field is additive; existing destructuring of { query,
countQuery } keeps working untouched.

Requires editing the work app: the ~10-line fusedQuery swap and the
recordsTotal caching. Both live in the consumer's service layer —
the library only generates strings; it never executes anything, so it
can't change which queries the app runs. That was the deal with the
driver-agnostic design.

Practical sequence: bump the version in package.json (it's still 0.3.10
— given the scope of this session, 0.4.0 is the honest increment),
publish/vendor it however the work app consumes it, upgrade the
dependency there and deploy — that ships all the crash fixes with
zero risk. Then the fusedQuery edit in the work repo is a separate,
small, independently-testable change whenever you're next in there.
