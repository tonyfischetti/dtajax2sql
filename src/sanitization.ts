
import {
  EscapedLIKE
} from "./types.js";

// import { compose } from './utils.js';


export const escapeID = (s: string): string => {
  if (typeof(s)!=='string') throw new Error ("escapeID expects a string");
  return `"${s.replaceAll(/"/g, '""')}"`;
};

//  TODO  How about other DBs
export const returnOkEscapeCharacter = (s: string): string => {
  if (!s.match(/\\/)) return '\\';
  if (!s.match(/@/)) return '@';
  if (!s.match(/!/)) return '!';
  if (!s.match(/λ/)) return 'λ';      // Greek
  if (!s.match(/齆/)) return '齆';    // Mandarin
  if (!s.match(/֎/)) return '֎';      // Armenian symbol
  if (!s.match(/پ/)) return 'پ';      // Farsi
  if (!s.match(/௺/)) return '௺';      // Tamil
  if (!s.match(/᭩/)) return '᭩';      // Balinese

  // this is for those times where you just need Greek, Chinese,
  // Persian, ... in one WHERE clause
  for (let i = 188; i <= 600; i++) {
    const c = String.fromCodePoint(i);
    if (!s.match(`${c}`)) return c;
  }
  throw new Error ("couldn't find escape character");
};

// const xlateChar = (s: string) => {
//   switch (s) {
//     case '\0'   : return "\\0";
//     // bells..., tabs..., other things...
//     case '\x08' : return "\\b";
//     case '\x09' : return "\\t";
//     case '\x1a' : return "\\z";
//     case '\n'   : return "\\n";
//     case '\r'   : return "\\r";
//     //  TODO  do I need these?
//     // case '"'    :
//     // case "'"    :
//     // case '\\'   : return `\\${s}`;
//     // // case '%'   : 
//     default    : return s;
//   }
// };


//  TODO  
// UNDERSCORE!!!!
// UNDERSCORE!!!!
// UNDERSCORE!!!!

// export const escapeString = (s: string): string => {
//   const culprits = /[\0\x08\x09\x1a\n\r"'\\]/g;
//   return s.replaceAll(culprits, xlateChar);
// };

export const escapeString = (s: string): string => {
  return s.replaceAll(/'/g, "''");
};

export const escapeForLIKE = (s: string): EscapedLIKE => {
  const better = escapeString(s);
  const okEscapeCharacter = returnOkEscapeCharacter(s);
  let retEscape = undefined;
  const retStr = better.replaceAll(/[%_]/g, (c) => {
    /*  NOTE  just in case we have to treat them differently */
    switch (c) {
      case '%' :
      case '_' :
        retEscape = okEscapeCharacter;
        return `${okEscapeCharacter}${c}`;
      default  : return c;
    }
  });
  return { str: retStr, escape: retEscape };
};

