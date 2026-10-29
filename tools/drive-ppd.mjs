#!/usr/bin/env node
// Drive ppd's real UI in headless Chrome the way a user would (type, click,
// pick from menus) and record every DataTables server-side request the page
// makes, with the live server's answer, as JSONL (same shape as
// capture-proxy.mjs, plus a `label` describing the user action).
//
//   node tools/drive-ppd.mjs [base=http://localhost:3000] [out=captured.jsonl]
// Chrome binary: $CHROME or the constant below.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';   // npm i --no-save puppeteer-core

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary';
const [, , base = 'http://localhost:3000', outFile = 'captured.jsonl'] = process.argv;
const PK = { main: 'Object_ID', constituents: 'Constituent_ID', exhibitions: 'Exhibition_ID' };
const SEL = {
  mode: '[class*="non-dt-search-options"] select',
  search: 'div.dt-search input',
  length: 'div.dt-length select',
  sb: 'div.dtsb-searchBuilder'
};

fs.writeFileSync(outFile, '');
const out = fs.createWriteStream(outFile, { flags: 'a' });
let n = 0, label = 'initial load';
const failures = [];
const pending = new Set();

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--window-size=1600,1400'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1400 });
page.setDefaultTimeout(30000);

const started = new Map();
const records = [];
const alerts = [];
// DataTables reports a server-side `error` with alert(); a headless page
// blocks on it until dismissed. Keep the text: it's what the user sees.
page.on('dialog', async (d) => {
  const message = d.message();
  alerts.push({ label, message });
  console.log(`  [alert] ${message.replace(/\s+/g, ' ').slice(0, 120)}`);
  await d.dismiss().catch(() => {});
});
page.on('request', (req) => { if (/\/dtajax/.test(req.url())) started.set(req, Date.now()); });
page.on('response', (r) => {
  if (!/\/dtajax/.test(r.url()) || r.request().method() !== 'POST') return;
  const p = (async () => {
    const req = r.request();
    const t0 = started.get(req) ?? Date.now();
    const table = r.url().match(/\/([^/]+)\/dtajax/)?.[1] ?? null;
    let request; try { request = JSON.parse(req.postData()); } catch { request = req.postData(); }
    let response;
    try {
      const j = await r.json();
      response = {
        status: r.status(), draw: j.draw, recordsTotal: j.recordsTotal, recordsFiltered: j.recordsFiltered,
        nData: Array.isArray(j.data) ? j.data.length : null,
        dataKeys: Array.isArray(j.data) ? j.data.slice(0, 100).map((row) => row[PK[table]]) : undefined,
        error: j.error ?? null
      };
    } catch (e) { response = { status: r.status(), raw: String(e.message).slice(0, 200) }; }
    const rec = { id: ++n, t: new Date(t0).toISOString(), url: new URL(r.url()).pathname, table, label, request, response, elapsedMs: Date.now() - t0 };
    records.push(rec);
    out.write(JSON.stringify(rec) + '\n');
    const err = response.error ? '  ERROR: ' + String(response.error).replace(/\s+/g, ' ').slice(0, 70) : '';
    console.log(`  #${String(n).padStart(3)} ${table.padEnd(12)} ${String(response.status).padEnd(4)} filtered=${String(response.recordsFiltered).padEnd(7)} rows=${String(response.nData).padEnd(5)} ${String(rec.elapsedMs).padStart(5)}ms  ${label}${err}`);
  })();
  pending.add(p); p.finally(() => pending.delete(p));
});

const processingHidden = (timeout = 60000) => page.waitForFunction(() => {
  const p = document.querySelector('div.dt-processing');
  return !p || getComputedStyle(p).display === 'none';
}, { timeout });

// perform one user action and wait for the request(s) it causes
const act = async (what, fn, { expectRequest = true, timeout = 30000 } = {}) => {
  label = what;
  const before = n;
  try {
    const waiter = expectRequest
      ? page.waitForResponse((r) => /\/dtajax/.test(r.url()) && r.request().method() === 'POST', { timeout })
      : page.waitForNetworkIdle({ idleTime: 1500, timeout: 10000 });
    waiter.catch(() => {});                       // never leave it dangling if fn() throws
    await fn();
    await waiter;
    await page.waitForNetworkIdle({ idleTime: 400, timeout: 30000 }).catch(() => {});
    await processingHidden(Math.max(60000, timeout));
    await Promise.all([...pending]);
    if (expectRequest && n === before) throw new Error('no dtajax request was made');
    if (!expectRequest && n > before) console.log(`  (note: "${what}" made ${n - before} request(s))`);
  } catch (e) {
    failures.push({ label: what, error: e.message.split('\n')[0], requestsSeen: n - before });
    console.log(`  !! ${what}: ${e.message.split('\n')[0]} (${n - before} request(s) seen)`);
    await page.screenshot({ path: outFile.replace(/[^/]+$/, `fail-${failures.length}.png`) }).catch(() => {});
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => {});
    await Promise.all([...pending]);
  }
};

// ---- primitive user actions ---------------------------------------------
const typeSearch = async (text) => {
  await page.click(SEL.search, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  if (text) await page.type(SEL.search, text);
  await page.keyboard.press('Enter');
};
const setMode = (v) => page.select(SEL.mode, v);
const setLength = (v) => page.select(SEL.length, String(v));
const clickHeader = (text, shift = false) => page.evaluate((text, shift) => {
  const th = [...document.querySelectorAll('div.dt-scroll-head th')].find((h) => h.textContent.trim() === text);
  if (!th) throw new Error(`no header "${text}"`);
  th.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: shift }));
}, text, shift);
const clickPaging = (which) => page.evaluate((which) => {
  const btns = [...document.querySelectorAll('button.dt-paging-button')];
  const b = /^\d+$/.test(which) ? btns.find((x) => x.textContent.trim() === which) : btns.find((x) => x.classList.contains(which));
  if (!b) throw new Error(`no paging button "${which}"`);
  b.click();
}, which);

// SearchBuilder, through its own widgets. `group` = selector of the group to
// add into (the root builder, or a nested div.dtsb-group).
// click a group's own "Add Condition" (a direct child button) and return the new criterion
const sbAdd = async (groupHandle = null) => {
  const group = groupHandle ?? await page.$(`${SEL.sb} > div.dtsb-group`);
  const before = await page.$$eval('div.dtsb-criteria', (els) => els.length);
  await group.evaluate((g) => [...g.children].find((c) => c.matches('button.dtsb-add')).click());
  await page.waitForFunction((k) => document.querySelectorAll('div.dtsb-criteria').length > k, {}, before);
  return (await group.$$(':scope > div.dtsb-criteria')).at(-1);
};
const sbFill = async (crit, { data, condition, values = [], enter = true }) => {
  const dataSel = await crit.$('select.dtsb-data');
  const dataValue = await dataSel.evaluate((s, title) => [...s.options].find((o) => o.textContent.trim() === title)?.value, data);
  if (dataValue === undefined) throw new Error(`SearchBuilder has no column "${data}"`);
  await dataSel.select(dataValue);
  await crit.waitForSelector('select.dtsb-condition option:not([disabled])');
  const condSel = await crit.$('select.dtsb-condition');
  const condValue = await condSel.evaluate((s, c) => [...s.options].find((o) => o.value === c || o.textContent.trim() === c)?.value, condition);
  if (condValue === undefined) throw new Error(`no condition "${condition}" for "${data}": ` + await condSel.evaluate((s) => [...s.options].map((o) => o.value).join('|')));
  await condSel.select(condValue);
  if (values.length) {
    await crit.waitForSelector('.dtsb-value');
    const inputs = await crit.$$('.dtsb-value');
    for (let i = 0; i < values.length; i++) {
      const tag = await inputs[i].evaluate((e) => e.tagName);
      if (tag === 'SELECT') await inputs[i].select(values[i]);
      else { await inputs[i].click({ clickCount: 3 }); await inputs[i].type(String(values[i])); }
    }
    if (enter) await inputs[values.length - 1].press('Enter');
  }
};
const sbCondition = async (spec, group) => sbFill(await sbAdd(group), spec);

// ---- the session -----------------------------------------------------------
const section = (s) => console.log(`\n== ${s}`);
const settle = async () => { await page.waitForNetworkIdle({ idleTime: 500, timeout: 60000 }).catch(() => {}); await processingHidden(); await Promise.all([...pending]); };

section('main: load');
label = 'initial load';
await page.goto(base + '/', { waitUntil: 'networkidle0', timeout: 120000 });
await page.waitForSelector('#main-table tbody tr td');
await settle();

section('main: classic search strings');
for (const s of ['kafka', 'Kafka, Franz', '100%', 'R&B', "o'keeffe", 'jean-paul', 'José Guadalupe Posada', 'Käthe Kollwitz',
                 '%', '_', '"', '\\', ';', "' OR 1=1 --", '  kafka  ', 'kafka ', ' kafka', 'kafka  franz', '\tkafka', 'a'.repeat(300), '🎨', 'kafka franz', 'Title:kafka'])
  await act(`classic search ${JSON.stringify(s)}`, () => typeSearch(s));
await act('classic search cleared', () => typeSearch(''));

section('main: enhanced modes');
await act('search "kafka" then switch to ftglobal', async () => { await typeSearch('kafka'); await settle(); label = 'switch mode to ftglobal with "kafka"'; await setMode('ftglobal'); });
for (const s of ['kaf*', 'kafka OR proust', '"franz kafka"', 'Title:kafka', 'Display_Name:goya', '(kafka OR proust) NOT trial', 'NOT kafka', 'kafka AND',
                 '100%', 'R&B', "o'keeffe", 'jean-paul', '*69', 'kafka-', '"unterminated', 'goya^', '^goya', 'Foo:bar', 'kafka franz', ' kafka ', 'José Guadalupe Posada', ''])
  await act(`ftglobal search ${JSON.stringify(s)}`, () => typeSearch(s));
await act('switch mode to fttitles (empty search)', () => setMode('fttitles'));
for (const s of ['kafka', '*69', 'Title:kafka', 'Display_Name:goya', '"the trial"'])
  await act(`fttitles search ${JSON.stringify(s)}`, () => typeSearch(s));
await act('switch mode to ftconstituents with "the trial"', () => setMode('ftconstituents'));
for (const s of ['goya', 'Display_Name:goya', 'Title:kafka', 'go*', 'posada OR goya'])
  await act(`ftconstituents search ${JSON.stringify(s)}`, () => typeSearch(s));
await act('switch mode back to classic with "posada OR goya"', () => setMode('classic'));
await act('classic search cleared', () => typeSearch(''));

section('main: sorting');
await act('sort Title asc', () => clickHeader('Title'));
await act('sort Title desc', () => clickHeader('Title'));
await act('shift-click Dept. (multi-sort)', () => clickHeader('Dept.', true));
await act('shift-click Dept. again (desc)', () => clickHeader('Dept.', true));
await act('sort Display Name asc (single)', () => clickHeader('Display Name'));
await act('sort OID asc (back to default)', () => clickHeader('OID'));

section('main: page length and paging');
for (const len of [25, 100, 1000]) await act(`page length ${len}`, () => setLength(len));
await act('page length 10000', () => setLength(10000), { timeout: 240000 });
await act('page length 10', () => setLength(10), { timeout: 240000 });
await act('paging: next', () => clickPaging('next'));
await act('paging: next again', () => clickPaging('next'));
await act('paging: page 5', () => clickPaging('5'));
await act('paging: last', () => clickPaging('last'));
await act('paging: previous', () => clickPaging('previous'));
await act('paging: first', () => clickPaging('first'));
await act('search "kafka" then page 2', async () => { await typeSearch('kafka'); await settle(); label = 'paging: page 2 of "kafka"'; await clickPaging('2'); });
await act('search cleared', () => typeSearch(''));

section('main: column visibility (should not hit the server)');
await act('colvis: hide a column', async () => {
  await page.click('button.buttons-colvis');
  await page.waitForSelector('div.dt-button-collection button.buttons-columnVisibility');
  const items = await page.$$('div.dt-button-collection button.buttons-columnVisibility');
  await items[5].click();
  await page.keyboard.press('Escape');
}, { expectRequest: false });

section('main: SearchBuilder through its widgets');
await act('SB: Title contains kafka', () => sbCondition({ data: 'Title', condition: 'contains', values: ['kafka'] }));
await act('SB: + Display Name starts with "Kafka"', () => sbCondition({ data: 'Display Name', condition: 'starts', values: ['Kafka'] }));
await act('SB: toggle logic to OR', async () => {
  const k = n;
  await page.click(`${SEL.sb} button.dtsb-logic`);
  await page.waitForNetworkIdle({ idleTime: 1000, timeout: 5000 }).catch(() => {});
  if (n === k) { const inputs = await page.$$(`${SEL.sb} input.dtsb-value`); await inputs.at(-1).press('Enter'); }
});
await act('SB: + Begin Date between 1900 and 1950 (numeric)', () => sbCondition({ data: 'Begin Date', condition: 'between', values: ['1900', '1950'] }));
await act('SB: + Medium ends with "print"', () => sbCondition({ data: 'Medium', condition: 'ends', values: ['print'] }));
await act('SB: + Classification not contains "photo"', () => sbCondition({ data: 'Classification', condition: '!contains', values: ['photo'] }));
await act('SB: global search "goya" on top of 5 criteria', () => typeSearch('goya'));
await act('SB: sort Title desc on top', () => clickHeader('Title'));
await act('SB: page length 25 on top', () => setLength(25));
await act('SB: switch to ftglobal with criteria + "goya"', () => setMode('ftglobal'));
await act('SB: back to classic', () => setMode('classic'));
await act('SB: delete the first criterion', async () => {
  await page.click(`${SEL.sb} div.dtsb-criteria button.dtsb-delete`);
});
await act('SB: indent a criterion into a sub-group (no request expected)', async () => {
  await page.click(`${SEL.sb} div.dtsb-criteria button.dtsb-right`);
}, { expectRequest: false });
await act('SB: add a condition inside the sub-group (Country contains "France")', async () => {
  const nested = await page.$(`${SEL.sb} div.dtsb-group div.dtsb-group`);
  if (!nested) throw new Error('no nested group');
  await sbFill(await sbAdd(nested), { data: 'Country', condition: 'contains', values: ['France'] });
});
await act('SB: toggle the sub-group logic to OR', async () => {
  const k = n;
  await page.click(`${SEL.sb} div.dtsb-group div.dtsb-group button.dtsb-logic`);
  await page.waitForNetworkIdle({ idleTime: 1000, timeout: 5000 }).catch(() => {});
  if (n === k) { const inputs = await page.$$(`${SEL.sb} div.dtsb-group div.dtsb-group input.dtsb-value`); await inputs.at(-1).press('Enter'); }
});
// (DataTables ignores Enter when the search text hasn't changed, so use a new term)
await act('SB: unfilled extra condition row then global search "posada"', async () => {
  await sbAdd(); await settle(); label = 'SB: unfilled row present, global search "posada"'; await typeSearch('posada');
});
await act('SB: Dated is null', () => sbCondition({ data: 'Dated', condition: 'null' }));
await act('SB: clear all', () => page.click(`${SEL.sb} button.dtsb-clearAll`));
await act('search cleared after SB clear', () => typeSearch(''));
await act('SB: Object Count = 1 (numeric equals)', () => sbCondition({ data: 'Object Count', condition: '=', values: ['1'] }));
await act('SB: + Begin Date > 1900 (numeric)', () => sbCondition({ data: 'Begin Date', condition: '>', values: ['1900'] }));
await act('SB: + Value contains "5" (typed as string by DataTables)', () => sbCondition({ data: 'Value', condition: 'contains', values: ['5'] }));
await act('SB: + Title = exact (string equals via select?)', () => sbCondition({ data: 'Title', condition: '=', values: ['Self-Portrait'] }));
await act('SB: clear all (2)', () => page.click(`${SEL.sb} button.dtsb-clearAll`));

// the other two tables
for (const [path, table, textCol, sortCol] of [['/constituents', 'constituents', 'Display Name', 'Display Name'], ['/exhibitions', 'exhibitions', 'Title', 'Title']]) {
  section(`${table}: load`);
  label = `${table}: initial load`;
  await page.goto(base + path, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForSelector(`#${table}-table tbody tr td`);
  await settle();
  await act(`${table}: paging next`, () => clickPaging('next'));
  await act(`${table}: paging last`, () => clickPaging('last'));
  await act(`${table}: page length 100`, () => setLength(100));
  await act(`${table}: search "goya"`, () => typeSearch('goya'));
  await act(`${table}: search "o'keeffe"`, () => typeSearch("o'keeffe"));
  await act(`${table}: sort ${sortCol} asc`, () => clickHeader(sortCol));
  await act(`${table}: sort ${sortCol} desc`, () => clickHeader(sortCol));
  await act(`${table}: SB ${textCol} contains "a"`, () => sbCondition({ data: textCol, condition: 'contains', values: ['a'] }));
  await act(`${table}: SB clear all`, () => page.click(`${SEL.sb} button.dtsb-clearAll`));
  await act(`${table}: search cleared`, () => typeSearch(''));
}

await settle();
await browser.close();
out.end();
// attach each alert to the request it followed, and rewrite the file with that
for (const a of alerts) {
  const rec = [...records].reverse().find((r) => r.label === a.label);
  if (rec) rec.alert = a.message;
}
fs.writeFileSync(outFile, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`\n${n} requests recorded to ${outFile}; ${alerts.length} alert(s) shown to the user`);
if (failures.length) { console.log(`${failures.length} action(s) failed:`); for (const f of failures) console.log(`  - ${f.label}: ${f.error}`); }
