# tools/

Maintainer scripts for checking the library against **real** DataTables
requests instead of hand-written ones. None of them are part of the
published package or the normal test run; `test/ppd-requests-tests.js`
consumes their output from `test/fixtures/ppd/`.

The record format shared by the two capture tools, one JSON object per
line:

```
{ id, t, url, table, label?, request, response: { status, draw, recordsTotal,
  recordsFiltered, nData, dataKeys, error }, elapsedMs, alert? }
```

`request` is the DataTables request body verbatim (ppd adds
`globalSearchMode` to it). `dataKeys` are the first 100 primary keys the
server returned. `alert` is the text DataTables showed the user when the
server answered with an `error`.

## capture-proxy.mjs (no dependencies)

A logging reverse proxy for any DataTables server-side app:

```sh
node tools/capture-proxy.mjs http://localhost:3000 3001 captured.jsonl
```

Browse `http://localhost:3001` instead of the app and use it normally.
Every `POST …/dtajax` is appended to `captured.jsonl`. Everything else,
including Next.js's HMR websocket, passes through untouched, so the app
needs no changes.

## drive-ppd.mjs (needs puppeteer-core and a Chrome)

Drives ppd's real UI headlessly the way a user would (typing searches,
switching search modes, sorting, paging, changing page length, building
SearchBuilder criteria with its own widgets, including nested groups and
unfilled rows) and records every request the page makes, with a `label`
naming the user action. Server-side `error`s surface as DataTables
alerts; those are dismissed and their text kept on the record.

```sh
npm i --no-save puppeteer-core          # one-off, not a devDependency
# ppd dev server running on :3000 with ppd.db in place
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  node tools/drive-ppd.mjs http://localhost:3000 captured.jsonl
```

Expect it to take several minutes: the 10,000-rows-per-page step alone
takes the browser about three minutes to render.

## replay-ppd-corpus.mjs (needs ppd.db)

Replays a capture through one or more dtajax2sql builds against ppd.db,
mirroring ppd's handler (`lib/api/make-dtajax-handler.ts`), and compares
each build with what the live server answered (same rows and count, or
the same kind of error) and the first two builds with each other (SQL
text byte for byte).

```sh
npm i --prefix /tmp/v0310 dtajax2sql@0.3.10
PPD_DIR=~/path/to/ppd node tools/replay-ppd-corpus.mjs captured.jsonl report.json \
  v0.3.10=/tmp/v0310/node_modules/dtajax2sql HEAD=.
```

## build-fixture.mjs and dump-schema.mjs

Turn a capture into `test/fixtures/ppd/requests.json` (every request
verbatim, each table's identical `columns` array stored once), and write
the DDL of the ppd tables (no data) to `test/fixtures/ppd/schema.sql`:

```sh
node tools/build-fixture.mjs captured.jsonl
PPD_DIR=~/path/to/ppd node tools/dump-schema.mjs
npm test
```
