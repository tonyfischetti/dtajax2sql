# dtajax2sql

A set of functions to help convert DataTables server-side AJAX calls into
SQL.

The architecture is designed to accomodate different RDBMSs and dialects,
but SQLite is the only one currently implemented


__WARNING__: This is nowhere _close_ to production-ready. Please don't use
this package until this warning is removed and the version hits >= 0.5.0

__WARNING__: The escaping rules for SQLite are different than those of
other data bases. This is, as of now, only safe for use against
SQLite DBs.
