
/*
 * Turning a search-box string into an FTS5 query
 *
 * FTS5 has a small query language (sqlite.org/fts5.html#full_text_query_syntax):
 * barewords and "quoted strings" are phrases, a trailing * makes a
 * prefix query, a leading ^ anchors to the first token, col:phrase
 * restricts to one column, upper-case AND / OR / NOT combine, and
 * parentheses group. Anything else outside quotes is a syntax error:
 * `100%`, `R&B`, `u.s.a`, `keepin'`, a leading `*`, an unmatched quote
 * or parenthesis, an operator with nothing on one side.
 *
 * 0.3.10 passed the string straight through: power users had the whole
 * language, everyone else got "fts5: syntax error" on punctuation.
 * 0.4.0 quoted every whitespace-separated token, which fixed the errors
 * and silently removed the language.
 *
 * This keeps both. The input is lexed with FTS5's definition of a
 * bareword and re-emitted in a subset of the grammar that cannot be
 * malformed:
 *   - every phrase is double-quoted, so punctuation inside it is just
 *     tokenizer input ("100%" matches via the token 100; "keepin'" via
 *     keepin; "jean-paul" is the phrase jean paul)
 *   - a trailing * on a word or a quoted phrase stays a prefix query
 *   - a leading ^ stays a first-token anchor
 *   - name:phrase and "quoted name":phrase stay column filters
 *   - upper-case AND / OR / NOT stay operators only where they have an
 *     operand on both sides; anywhere else they are just words
 *   - parentheses stay groups only when balanced (and not absurdly
 *     deep), and are always joined to their neighbours with an explicit
 *     AND, which FTS5 insists on
 *   - tokens with no word characters at all (`-`, `%`, `...`) vanish
 *
 * Column filters are the one thing that can still fail at run time: an
 * unknown column is "no such column", exactly as in 0.3.10, because
 * this module doesn't know the table's columns.
 */

interface FtTerm {
  kind:   'term';
  text:   string;
  quoted: boolean;
  prefix: boolean;             // trailing `*`
  caret:  boolean;             // leading `^`
  col:    string | undefined;  // `col:` filter
}
interface FtOp    { kind: 'op'; op: 'AND' | 'OR' | 'NOT' }
interface FtOpen  { kind: 'open' }
interface FtClose { kind: 'close' }
type FtItem = FtTerm | FtOp | FtOpen | FtClose;

interface FtGroup { kind: 'group'; items: FtSeq }
type FtNode = FtTerm | FtGroup;
type FtSeq  = Array<FtNode | FtOp>;

/* what FTS5 accepts in a bareword: ASCII alphanumerics, `_`, U+001A, and everything non-ASCII */
const WORD_CHAR   = /[A-Za-z0-9_\u001A]|[^\u0000-\u007F]/;
/* what we accept as a bare column name in `name:phrase` (so `3:16` stays a phrase) */
const BARE_IDENT  = /^[\p{L}_][\p{L}\p{N}_]*$/u;
const BARE_COLUMN = /^([\p{L}_][\p{L}\p{N}_]*):(.*)$/u;
const MAX_PAREN_DEPTH = 32;

const hasWordChar   = (s: string): boolean => WORD_CHAR.test(s);
const isSpace       = (c: string): boolean => /\s/.test(c);
const startsOperand = (s: string): boolean => s !== '' && (hasWordChar(s.charAt(0)) || s.startsWith('^'));


/***********************************************************
 * lexing
 */

const lex = (s: string, parensSpecial: boolean): FtItem[] => {
  const items: FtItem[] = [];
  let col: string | undefined;   // pending `name:` for the next term
  let caret = false;             // pending `^` for the next term
  let glued = false;             // no whitespace since the previous item
  let i = 0;

  const isParen = (c: string): boolean => parensSpecial && (c === '(' || c === ')');
  const lastTerm = (): FtTerm | undefined => {
    const last = items[items.length - 1];
    return last !== undefined && last.kind === 'term' ? last : undefined;
  };
  const dropPending = (): void => { col = undefined; caret = false; glued = false; };
  const pushTerm = (text: string, quoted: boolean, prefix: boolean): void => {
    //  nothing a tokenizer could use (`-`, `%`, `""`): drop it, and act
    //  like whitespace so neighbours don't glue across it
    if (!hasWordChar(text)) { dropPending(); return; }
    items.push({ kind: 'term', text, quoted, prefix, caret, col });
    col = undefined;
    caret = false;
    glued = true;
  };

  while (i < s.length) {
    const ch = s.charAt(i);

    if (isSpace(ch)) { glued = false; i++; continue; }

    if (ch === '"') {
      //  a quoted string; "" is an escaped quote; unterminated runs to the end
      let text = '';
      let j = i + 1;
      while (j < s.length) {
        if (s.charAt(j) === '"') {
          if (s.charAt(j + 1) === '"') { text += '"'; j += 2; continue; }
          break;
        }
        text += s.charAt(j);
        j++;
      }
      i = Math.min(j + 1, s.length);
      pushTerm(text, true, false);
      continue;
    }

    if (isParen(ch)) {
      items.push({ kind: ch === '(' ? 'open' : 'close' });
      dropPending();
      i++;
      continue;
    }

    //  a run of anything else, up to whitespace, a quote or a paren
    let j = i;
    while (j < s.length && !isSpace(s.charAt(j)) && s.charAt(j) !== '"' && !isParen(s.charAt(j))) j++;
    let run = s.slice(i, j);
    i = j;
    const nextIsQuote = s.charAt(i) === '"';
    const prev = lastTerm();
    const gluedToPrev = glued && prev !== undefined;

    //  `"keep"*` --- stars right after a term make it a prefix query
    if (/^\*+$/.test(run)) {
      if (gluedToPrev) prev.prefix = true;
      else glued = false;
      continue;
    }

    //  `"Song title":keepin`, `"Song title":"keepin"` --- a colon right
    //  after a term turns that term into the column filter of the next
    if (run.startsWith(':') && gluedToPrev &&
        prev.col === undefined && !prev.caret && !prev.prefix &&
        (prev.quoted || BARE_IDENT.test(prev.text))) {
      const rest = run.slice(1);
      if (rest === '' && nextIsQuote) { items.pop(); col = prev.text; continue; }
      if (startsOperand(rest))        { items.pop(); col = prev.text; run = rest; }
    }

    //  `Title:kafka`, `Title:^kaf*`, `Title:"new york"`
    if (col === undefined) {
      const m = BARE_COLUMN.exec(run);
      const name = m?.[1], rest = m?.[2];
      if (name !== undefined && rest !== undefined) {
        if (rest === '' && nextIsQuote) { col = name; continue; }
        if (startsOperand(rest))        { col = name; run = rest; }
      }
    }

    //  AND / OR / NOT: upper-case, a whole bare word, not under a column filter
    if (col === undefined && !caret && (run === 'AND' || run === 'OR' || run === 'NOT')) {
      items.push({ kind: 'op', op: run });
      glued = true;
      continue;
    }

    //  `^keepin`, `^"keepin it"`
    if (run === '^' && nextIsQuote) { caret = true; continue; }
    if (run.startsWith('^') && run.length > 1) { caret = true; run = run.slice(1); }

    //  `keep*`
    let prefix = false;
    const stars = /\*+$/.exec(run);
    if (stars !== null && stars.index > 0) { prefix = true; run = run.slice(0, stars.index); }

    pushTerm(run, false, prefix);
  }
  return items;
};

/* balanced, and not nested absurdly deep; otherwise parentheses are just characters */
const parensUsable = (items: FtItem[]): boolean => {
  let depth = 0;
  for (const it of items) {
    if (it.kind === 'open')  { depth++; if (depth > MAX_PAREN_DEPTH) return false; }
    if (it.kind === 'close') { depth--; if (depth < 0) return false; }
  }
  return depth === 0;
};


/***********************************************************
 * grouping
 */

const buildTree = (items: FtItem[]): FtSeq => {
  const stack: FtSeq[] = [[]];
  const top = (): FtSeq => {
    const t = stack[stack.length - 1];
    if (t === undefined) throw new Error("unbalanced parentheses");   // can't happen: parensUsable ran first
    return t;
  };
  for (const it of items) {
    if (it.kind === 'open') { stack.push([]); continue; }
    if (it.kind === 'close') {
      const group = stack.pop() ?? [];
      if (group.some(x => x.kind !== 'op'))
        top().push({ kind: 'group', items: group });
      else
        //  a group with no phrase in it (`()`, `(OR)`): its operators are just words
        for (const op of group)
          if (op.kind === 'op')
            top().push({ kind: 'term', text: op.op, quoted: false, prefix: false, caret: false, col: undefined });
      continue;
    }
    top().push(it);
  }
  return top();
};


/***********************************************************
 * emitting
 */

const quote = (s: string): string => `"${s.replaceAll('"', '""')}"`;

const renderTerm = (t: FtTerm): string =>
  `${t.col !== undefined ? quote(t.col) + ':' : ''}${t.caret ? '^' : ''}${quote(t.text)}${t.prefix ? '*' : ''}`;

const serialize = (seq: FtSeq): string => {
  const out: Array<{ sql: string; operand: boolean; group: boolean }> = [];
  const pushOperand = (sql: string, group: boolean): void => {
    const prev = out[out.length - 1];
    //  NOTE  FTS5 allows an implicit AND between two phrases, but not
    //        between a phrase and a parenthesised group
    if (prev !== undefined && prev.operand && (prev.group || group))
      out.push({ sql: 'AND', operand: false, group: false });
    out.push({ sql, operand: true, group });
  };
  seq.forEach((item, idx) => {
    if (item.kind === 'op') {
      const prev = out[out.length - 1];
      const next = seq[idx + 1];
      if (prev !== undefined && prev.operand && next !== undefined && next.kind !== 'op')
        out.push({ sql: item.op, operand: false, group: false });
      else
        pushOperand(quote(item.op), false);   // nothing to operate on: it's just a word
      return;
    }
    if (item.kind === 'group') pushOperand(`(${serialize(item.items)})`, true);
    else                       pushOperand(renderTerm(item), false);
  });
  return out.map(x => x.sql).join(' ');
};


/***********************************************************
 * the one export
 */

/*
 * the FTS5 query expression for a search-box string, or '' when there is
 * nothing searchable in it. NOT yet a SQL string literal: the caller
 * still has to quote it (`quoteString`), since phrases may contain `'`
 */
export const toFts5Query = (s: string): string => {
  const cleaned = s.replaceAll(/\u0000/g, '').normalize('NFD');
  let items = lex(cleaned, true);
  if (!parensUsable(items)) items = lex(cleaned, false);
  return serialize(buildTree(items));
};

