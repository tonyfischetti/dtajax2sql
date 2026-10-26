
import { SQLFragment } from "./types";

export const negateClause = (clause: SQLFragment): SQLFragment => {
  return `(NOT ${clause})`;
};

/* a plain object: not null, not an array */
export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const parseNumberHelper = (str: string): number => {
  const num = parseInt(str, 10);
  if (isNaN(num)) throw new Error("couldn't parse number");
  return num;
};

/*
 * strict counterpart to the above for values that index or page:
 * accepts a non-negative safe integer as a number (JSON bodies) or as
 * a canonical decimal string (query strings) --- no `parseInt`
 * permissiveness ("10 rows" -> 10, "1.5" -> 1), no leading zeros,
 * no sign
 */
export const parseNonNegativeIntegerHelper = (value: unknown,
                                              what = 'value'): number => {
  const ok =
    (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) ||
    (typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value) &&
     Number.isSafeInteger(Number(value)));
  if (!ok) throw new Error(`${what} must be a non-negative integer`);
  return Number(value);
};

// When you have a lot of columns, datatables sends the columns
// in a weird way. This converts it back to what's expected
export const convertColumnPropToArray = (columns: any) => {
  const thekeys = Object.keys(columns);
  const newcols = thekeys.map(i => columns[i]);
  return newcols;
};

/*
 * qs (which Express uses to parse query strings) only parses brackets
 * to a depth limit (default 5); everything past that arrives as
 * flattened literal keys, e.g.
 *
 *   { "[0][condition]": "=", "[0][value][]": "1", ... }
 *
 * these helpers convert that back into real arrays/objects
 */

const parseBracketPath = (key: string): Array<string> => {
  return [...key.matchAll(/\[([^\]]*)\]/g)].map(m => m[1] ?? '');
};

const isFlattenedBracketKeyObject = (obj: object): boolean => {
  const thekeys = Object.keys(obj);
  return thekeys.length > 0 && thekeys.every(k => /^(\[[^\]]*\])+$/.test(k));
};

export const unflattenBracketKeys = (flat: Record<string, any>): any => {
  //  NOTE  a flattened remainder always starts with an index ("[0]...")
  const root: any = [];
  for (const [key, value] of Object.entries(flat)) {
    const path = parseBracketPath(key);
    let node: any = root;
    for (let i = 0; i < path.length; i++) {
      const seg = path[i] ?? '';
      if (i === path.length - 1) {
        //  a trailing "[]" (e.g. "[0][value][]") means "append"
        if (seg === '') node.push(value);
        else node[seg] = value;
      } else {
        const nextSeg = path[i + 1] ?? '';
        if (node[seg] === undefined)
          node[seg] = (nextSeg === '' || /^\d+$/.test(nextSeg)) ? [] : {};
        node = node[seg];
      }
    }
  }
  return root;
};

// heals a SearchBuilder tree: at EVERY depth, criteria that arrived as
// objects (numeric-keyed, or flattened past qs's depth limit) become
// proper arrays. Returns a new tree; the input is never modified
export const healSearchBuilderTree = (sb: unknown): unknown => {
  if (!isRecord(sb) || !("criteria" in sb))
    return sb;
  let criteria = sb['criteria'];
  //  NOTE  only object-shaped criteria are converted; anything else is
  //        left alone for the validator to reject with a real message
  if (isRecord(criteria))
    criteria = isFlattenedBracketKeyObject(criteria)
      ? unflattenBracketKeys(criteria)
      : convertColumnPropToArray(criteria);
  if (Array.isArray(criteria))
    criteria = criteria.map(c => healSearchBuilderTree(c));
  return { ...sb, criteria };
};

export const withEsc = (base: string, escape: string | undefined) => {
  if (escape)
    return `${base} ESCAPE '${escape}'`;
  return base;
};

export const parenthisize = (s: string) => {
  return `(${s})`;
};

