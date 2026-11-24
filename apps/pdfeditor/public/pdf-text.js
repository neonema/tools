// Page text editing in the PDF itself. Reads a page's content stream, finds the glyphs of an
// edited run, removes them, and writes the new text in their place in the original font, so the
// change keeps the run's font, size, colour, and spacing. Glyphs around the run keep their exact
// positions. Exposes globalThis.PdfText; needs pdf-lib (globalThis.PDFLib).
(function () {
  const WHITESPACE = new Set([0, 9, 10, 12, 13, 32]);
  const DELIMITERS = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);
  const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)$/;
  const ESCAPES = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };

  // WinAnsiEncoding codes 128-159 that differ from Latin-1. Other codes 32-255 match Latin-1.
  const WIN_ANSI_HIGH = {
    128: "€", 130: "‚", 131: "ƒ", 132: "„", 133: "…", 134: "†", 135: "‡", 136: "ˆ", 137: "‰", 138: "Š",
    139: "‹", 140: "Œ", 142: "Ž", 145: "‘", 146: "’", 147: "“", 148: "”", 149: "•", 150: "–", 151: "—",
    152: "˜", 153: "™", 154: "š", 155: "›", 156: "œ", 158: "ž", 159: "Ÿ",
  };

  function winAnsiChar(code) {
    if (code >= 32 && code <= 126) return String.fromCharCode(code);
    if (code >= 160 && code <= 255) return String.fromCharCode(code);
    return WIN_ANSI_HIGH[code] || null;
  }

  // MacRomanEncoding codes 128-255 (macOS Quartz writes PDFs with it). 0xF0 is the Apple logo.
  const MAC_ROMAN_HIGH =
    "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ";

  function macRomanChar(code) {
    if (code >= 32 && code <= 126) return String.fromCharCode(code);
    if (code >= 128 && code <= 255) return MAC_ROMAN_HIGH[code - 128] || null;
    return null;
  }

  function charForCode(font, code) {
    return font.macRoman ? macRomanChar(code) : winAnsiChar(code);
  }

  // ---- Content stream lexer and parser -------------------------------------------------------

  function lex(s) {
    const tokens = [];
    const n = s.length;
    let i = 0;
    while (i < n) {
      const c = s.charCodeAt(i);
      if (WHITESPACE.has(c)) {
        i += 1;
        continue;
      }
      if (c === 37) {
        while (i < n && s[i] !== "\n" && s[i] !== "\r") i += 1;
        continue;
      }
      const start = i;
      if (c === 40) {
        let depth = 1;
        let out = "";
        i += 1;
        while (i < n && depth > 0) {
          const ch = s[i];
          if (ch === "\\") {
            const next = s[i + 1];
            if (next === undefined) {
              i += 1;
              break;
            }
            if (ESCAPES[next] !== undefined) {
              out += ESCAPES[next];
              i += 2;
            } else if (next >= "0" && next <= "7") {
              let j = i + 1;
              let oct = "";
              while (j < n && oct.length < 3 && s[j] >= "0" && s[j] <= "7") oct += s[j++];
              out += String.fromCharCode(parseInt(oct, 8) & 255);
              i = j;
            } else if (next === "\r") {
              i += s[i + 2] === "\n" ? 3 : 2;
            } else if (next === "\n") {
              i += 2;
            } else {
              out += next;
              i += 2;
            }
            continue;
          }
          if (ch === "(") depth += 1;
          else if (ch === ")") {
            depth -= 1;
            if (depth === 0) {
              i += 1;
              break;
            }
          }
          out += ch;
          i += 1;
        }
        tokens.push({ t: "str", v: out, start, end: i });
        continue;
      }
      if (c === 60) {
        if (s[i + 1] === "<") {
          tokens.push({ t: "<<", start, end: i + 2 });
          i += 2;
          continue;
        }
        let j = i + 1;
        let hex = "";
        while (j < n && s[j] !== ">") {
          if (/[0-9a-fA-F]/.test(s[j])) hex += s[j];
          j += 1;
        }
        if (hex.length % 2) hex += "0";
        let out = "";
        for (let k = 0; k < hex.length; k += 2) out += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16));
        tokens.push({ t: "str", v: out, start, end: j + 1 });
        i = j + 1;
        continue;
      }
      if (c === 62) {
        if (s[i + 1] === ">") {
          tokens.push({ t: ">>", start, end: i + 2 });
          i += 2;
        } else i += 1;
        continue;
      }
      if (c === 91 || c === 93 || c === 123 || c === 125) {
        tokens.push({ t: s[i], start, end: i + 1 });
        i += 1;
        continue;
      }
      if (c === 47) {
        let j = i + 1;
        while (j < n && !WHITESPACE.has(s.charCodeAt(j)) && !DELIMITERS.has(s.charCodeAt(j))) j += 1;
        tokens.push({ t: "name", v: s.slice(i + 1, j), start, end: j });
        i = j;
        continue;
      }
      let j = i;
      while (j < n && !WHITESPACE.has(s.charCodeAt(j)) && !DELIMITERS.has(s.charCodeAt(j))) j += 1;
      if (j === i) {
        i += 1;
        continue;
      }
      const word = s.slice(i, j);
      if (NUMBER.test(word)) {
        tokens.push({ t: "num", v: parseFloat(word), start, end: j });
      } else {
        tokens.push({ t: "op", v: word, start, end: j });
        if (word === "ID") {
          // Inline image data is binary; skip to the EI that ends it.
          let k = j + 1;
          while (k < n) {
            if (
              s[k] === "E" &&
              s[k + 1] === "I" &&
              WHITESPACE.has(s.charCodeAt(k - 1)) &&
              (k + 2 >= n || WHITESPACE.has(s.charCodeAt(k + 2)))
            ) {
              break;
            }
            k += 1;
          }
          tokens.push({ t: "op", v: "EI", start: k, end: Math.min(n, k + 2) });
          j = k + 2;
        }
      }
      i = j;
    }
    return tokens;
  }

  function parseOps(s) {
    const ops = [];
    const stack = [];
    let operands = [];
    let first = null;
    for (const token of lex(s)) {
      if (first === null) first = token.start;
      if (token.t === "[" || token.t === "<<") {
        stack.push(operands);
        operands = [];
        continue;
      }
      if (token.t === "]" || token.t === ">>") {
        const inner = operands;
        operands = stack.pop() || [];
        operands.push({ t: token.t === "]" ? "arr" : "dict", v: inner });
        continue;
      }
      if (token.t === "op" && !stack.length) {
        ops.push({ op: token.v, args: operands, start: first, end: token.end });
        operands = [];
        first = null;
        continue;
      }
      operands.push(token);
    }
    return ops;
  }

  // ---- Fonts ---------------------------------------------------------------------------------

  function parseToUnicode(s) {
    const map = new Map();
    const utf16 = (hex) => {
      let out = "";
      const padded = hex.length % 4 ? hex.padStart(Math.ceil(hex.length / 4) * 4, "0") : hex;
      for (let i = 0; i < padded.length; i += 4) out += String.fromCharCode(parseInt(padded.slice(i, i + 4), 16));
      return out;
    };
    for (const block of s.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) map.set(parseInt(m[1], 16), utf16(m[2]));
    }
    for (const block of s.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(<[0-9a-fA-F]*>|\[[^\]]*\])/g)) {
        const low = parseInt(m[1], 16);
        const high = parseInt(m[2], 16);
        if (high < low || high - low > 65535) continue;
        if (m[3][0] === "[") {
          [...m[3].matchAll(/<([0-9a-fA-F]*)>/g)].forEach((item, k) => map.set(low + k, utf16(item[1])));
        } else {
          const base = utf16(m[3].slice(1, -1));
          if (!base) continue;
          const last = base.charCodeAt(base.length - 1);
          for (let code = low; code <= high; code += 1) {
            map.set(code, base.slice(0, -1) + String.fromCharCode(last + code - low));
          }
        }
      }
    }
    return map;
  }

  function streamText(L, stream) {
    if (!stream) return null;
    try {
      let bytes;
      if (stream instanceof L.PDFRawStream) bytes = L.decodePDFRawStream(stream).decode();
      else if (typeof stream.getUnencodedContents === "function") bytes = stream.getUnencodedContents();
      else return null;
      return bytesToString(bytes);
    } catch {
      return null;
    }
  }

  function bytesToString(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return out;
  }

  function stringToBytes(s) {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i += 1) bytes[i] = s.charCodeAt(i) & 255;
    return bytes;
  }

  function nameOf(value) {
    return value ? String(value).replace(/^\//, "") : "";
  }

  function numberOf(L, value) {
    return value instanceof L.PDFNumber ? value.asNumber() : undefined;
  }

  function lookup(L, dict, key) {
    if (!dict || typeof dict.lookup !== "function") return undefined;
    try {
      return dict.lookup(L.PDFName.of(key));
    } catch {
      return undefined;
    }
  }

  function readFont(L, dict) {
    const subtype = nameOf(lookup(L, dict, "Subtype"));
    const baseFont = nameOf(lookup(L, dict, "BaseFont"));
    const font = {
      baseFont,
      // Subsets of one typeface share this name; StemV tells their weights apart.
      typeface: baseFont.replace(/^[A-Z]{6}\+/, ""),
      stemV: 0,
      subset: /^[A-Z]{6}\+/.test(baseFont),
      twoByte: false,
      usable: true,
      widths: new Map(),
      defaultWidth: 0,
      toUnicode: null,
      encoder: null,
      standard: null,
      winAnsi: false,
    };
    if (subtype === "Type3") font.usable = false;
    if (subtype === "Type0") {
      font.twoByte = true;
      if (nameOf(lookup(L, dict, "Encoding")) !== "Identity-H") font.usable = false;
      const descendants = lookup(L, dict, "DescendantFonts");
      const cid = descendants && typeof descendants.lookup === "function" ? descendants.lookup(0) : undefined;
      font.defaultWidth = numberOf(L, lookup(L, cid, "DW")) ?? 1000;
      font.stemV = numberOf(L, lookup(L, lookup(L, cid, "FontDescriptor"), "StemV")) || 0;
      const w = lookup(L, cid, "W");
      if (w && typeof w.size === "function") {
        const items = [];
        for (let i = 0; i < w.size(); i += 1) items.push(w.lookup(i));
        for (let i = 0; i < items.length; ) {
          const first = numberOf(L, items[i]);
          const next = items[i + 1];
          if (next && typeof next.size === "function") {
            for (let k = 0; k < next.size(); k += 1) font.widths.set(first + k, numberOf(L, next.lookup(k)) ?? font.defaultWidth);
            i += 2;
          } else {
            const last = numberOf(L, next);
            const width = numberOf(L, items[i + 2]);
            if (first !== undefined && last !== undefined && last - first < 65536) {
              for (let code = first; code <= last; code += 1) font.widths.set(code, width ?? font.defaultWidth);
            }
            i += 3;
          }
        }
      }
    } else {
      const encoding = lookup(L, dict, "Encoding");
      const encodingName = nameOf(encoding);
      font.macRoman = encodingName === "MacRomanEncoding";
      font.winAnsi = font.macRoman || !encoding || encodingName === "WinAnsiEncoding" || encodingName === "StandardEncoding";
      const firstChar = numberOf(L, lookup(L, dict, "FirstChar"));
      const widths = lookup(L, dict, "Widths");
      if (widths && typeof widths.size === "function" && firstChar !== undefined) {
        for (let i = 0; i < widths.size(); i += 1) font.widths.set(firstChar + i, numberOf(L, widths.lookup(i)) ?? 0);
      }
      const descriptor = lookup(L, dict, "FontDescriptor");
      font.defaultWidth = numberOf(L, lookup(L, descriptor, "MissingWidth")) ?? 0;
      font.stemV = numberOf(L, lookup(L, descriptor, "StemV")) || 0;
      if (Object.values(L.StandardFonts).includes(baseFont)) {
        try {
          font.standard = L.StandardFontEmbedder.for(baseFont);
        } catch {
          font.standard = null;
        }
      }
    }
    // What the font library matches on when a letter has to come from a free font (see libraryInfo).
    const descendantsForInfo = font.twoByte ? lookup(L, dict, "DescendantFonts") : null;
    const descriptorOwner = font.twoByte
      ? descendantsForInfo && typeof descendantsForInfo.lookup === "function"
        ? descendantsForInfo.lookup(0)
        : null
      : dict;
    const descriptorDict = lookup(L, descriptorOwner, "FontDescriptor");
    font.flags = numberOf(L, lookup(L, descriptorDict, "Flags")) || 0;
    font.italicAngle = numberOf(L, lookup(L, descriptorDict, "ItalicAngle")) || 0;
    font.capHeight = numberOf(L, lookup(L, descriptorDict, "CapHeight")) || 0;
    font.xHeight = numberOf(L, lookup(L, descriptorDict, "XHeight")) || 0;
    const toUnicode = streamText(L, lookup(L, dict, "ToUnicode"));
    if (toUnicode) font.toUnicode = parseToUnicode(toUnicode);
    // The embedded TrueType program, read only when a glyph outline is needed.
    font.programSource = () => {
      const descendants = font.twoByte ? lookup(L, dict, "DescendantFonts") : null;
      const owner = font.twoByte ? (descendants && typeof descendants.lookup === "function" ? descendants.lookup(0) : null) : dict;
      const fontFile = lookup(L, lookup(L, owner, "FontDescriptor"), "FontFile2");
      const bytes = streamBytes(L, fontFile);
      if (!bytes) return null;
      let cidToGid = null;
      if (font.twoByte) {
        const map = lookup(L, owner, "CIDToGIDMap");
        if (map && map.dict) cidToGid = streamBytes(L, map);
        else if (map && nameOf(map) !== "Identity") return null;
      }
      return { bytes, cidToGid };
    };
    return font;
  }

  // ---- Glyph outlines ------------------------------------------------------------------------
  // Read from embedded TrueType programs, only to check whether one letter is another turned
  // upside down (see twinFor). Composite glyphs and CFF fonts are not read.

  function streamBytes(L, stream) {
    try {
      if (!stream || !stream.dict) return null;
      return lookup(L, stream.dict, "Filter") ? L.decodePDFRawStream(stream).decode() : stream.getContents();
    } catch {
      return null;
    }
  }

  function readTrueType(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tables = {};
    const count = view.getUint16(4);
    for (let i = 0; i < count; i += 1) {
      const at = 12 + 16 * i;
      const tag = String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
      tables[tag] = { offset: view.getUint32(at + 8), length: view.getUint32(at + 12) };
    }
    if (!tables.head || !tables.loca || !tables.glyf) return null;
    const unitsPerEm = view.getUint16(tables.head.offset + 18) || 1000;
    const longLoca = view.getInt16(tables.head.offset + 50) === 1;
    const loca = (gid) => (longLoca ? view.getUint32(tables.loca.offset + 4 * gid) : view.getUint16(tables.loca.offset + 2 * gid) * 2);
    const glyphCount = Math.floor(tables.loca.length / (longLoca ? 4 : 2)) - 1;

    // A simple glyph's outline in 1000-unit glyph space: { bbox, contours: [[{ x, y, on }]] }.
    const outline = (gid) => {
      if (!(gid > 0 && gid < glyphCount) || loca(gid + 1) <= loca(gid)) return null;
      const start = tables.glyf.offset + loca(gid);
      const contourCount = view.getInt16(start);
      if (contourCount <= 0) return null;
      const scale = 1000 / unitsPerEm;
      const bbox = [2, 4, 6, 8].map((k) => view.getInt16(start + k) * scale);
      let p = start + 10;
      const ends = [];
      for (let i = 0; i < contourCount; i += 1, p += 2) ends.push(view.getUint16(p));
      const pointCount = ends[ends.length - 1] + 1;
      p += 2 + view.getUint16(p);
      const flags = [];
      while (flags.length < pointCount) {
        const flag = bytes[p++];
        flags.push(flag);
        if (flag & 8) for (let repeat = bytes[p++]; repeat > 0; repeat -= 1) flags.push(flag);
      }
      const coords = (shortBit, sameBit) => {
        const out = [];
        let value = 0;
        for (const flag of flags) {
          if (flag & shortBit) {
            const delta = bytes[p++];
            value += flag & sameBit ? delta : -delta;
          } else if (!(flag & sameBit)) {
            value += view.getInt16(p);
            p += 2;
          }
          out.push(value * scale);
        }
        return out;
      };
      const xs = coords(2, 16);
      const ys = coords(4, 32);
      const contours = [];
      let first = 0;
      for (const end of ends) {
        const contour = [];
        for (let i = first; i <= end; i += 1) contour.push({ x: xs[i], y: ys[i], on: Boolean(flags[i] & 1) });
        contours.push(contour);
        first = end + 1;
      }
      return { bbox, contours };
    };

    // Glyph id for a single-byte code, from the font's own cmap: (3,0) symbol or (1,0) Mac Roman.
    const cmaps = [];
    if (tables.cmap) {
      const base = tables.cmap.offset;
      for (let i = 0; i < view.getUint16(base + 2); i += 1) {
        cmaps.push({
          platform: view.getUint16(base + 4 + 8 * i),
          encoding: view.getUint16(base + 6 + 8 * i),
          offset: base + view.getUint32(base + 8 + 8 * i),
        });
      }
    }
    const cmapLookup = (table, code) => {
      const format = view.getUint16(table.offset);
      if (format === 0) return code < 256 ? bytes[table.offset + 6 + code] : 0;
      if (format === 6) {
        const firstCode = view.getUint16(table.offset + 6);
        const entries = view.getUint16(table.offset + 8);
        return code >= firstCode && code < firstCode + entries ? view.getUint16(table.offset + 10 + 2 * (code - firstCode)) : 0;
      }
      if (format !== 4) return 0;
      const segments = view.getUint16(table.offset + 6) / 2;
      const endsAt = table.offset + 14;
      const startsAt = endsAt + 2 * segments + 2;
      const deltasAt = startsAt + 2 * segments;
      const rangesAt = deltasAt + 2 * segments;
      for (let s = 0; s < segments; s += 1) {
        if (code > view.getUint16(endsAt + 2 * s)) continue;
        const first = view.getUint16(startsAt + 2 * s);
        if (code < first) return 0;
        const delta = view.getInt16(deltasAt + 2 * s);
        const range = view.getUint16(rangesAt + 2 * s);
        if (!range) return (code + delta) & 0xffff;
        const glyph = view.getUint16(rangesAt + 2 * s + range + 2 * (code - first));
        return glyph ? (glyph + delta) & 0xffff : 0;
      }
      return 0;
    };
    const simpleGid = (code) => {
      for (const table of cmaps) {
        let gid = 0;
        if (table.platform === 3 && table.encoding === 0) gid = cmapLookup(table, 0xf000 + code) || cmapLookup(table, code);
        else if (table.platform === 1 && table.encoding === 0) gid = cmapLookup(table, code);
        if (gid) return gid;
      }
      return 0;
    };
    // Embedding permissions (OS/2 fsType): 2 Restricted, 4 Preview & Print, 8 Editable, 0 Installable.
    const fsType = tables["OS/2"] && tables["OS/2"].length >= 10 ? view.getUint16(tables["OS/2"].offset + 8) : null;
    return { outline, simpleGid, fsType };
  }

  function programOf(font) {
    if (font.program === undefined) {
      try {
        const source = font.programSource ? font.programSource() : null;
        const ttf = source ? readTrueType(source.bytes) : null;
        font.program = ttf ? { ttf, cidToGid: source.cidToGid } : null;
      } catch {
        font.program = null;
      }
    }
    return font.program;
  }

  // A font whose maker allows it only for viewing and printing (or not to be embedded at all) is
  // not used to write new text: the letters an edit adds come from a free font instead. When more
  // than one bit is set, the least restrictive applies. Fonts without the field are not restricted.
  function editingRestricted(font) {
    if (font.restricted === undefined) {
      const program = programOf(font);
      const fsType = program && program.ttf.fsType;
      font.restricted = fsType !== null && fsType !== undefined && (fsType & 8) === 0 && (fsType & 6) !== 0;
    }
    return font.restricted;
  }

  function glyphOutline(font, code) {
    programOf(font);
    if (!font.program) return null;
    try {
      const { ttf, cidToGid } = font.program;
      let gid = code;
      if (!font.twoByte) gid = ttf.simpleGid(code);
      else if (cidToGid) gid = 2 * code + 1 < cidToGid.length ? (cidToGid[2 * code] << 8) | cidToGid[2 * code + 1] : 0;
      return ttf.outline(gid);
    } catch {
      return null;
    }
  }

  // Points along an outline, about every 10 units, for comparing shapes.
  function outlineSamples(outline) {
    const out = [];
    const line = (a, b) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10));
      for (let i = 0; i < steps; i += 1) out.push([a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps]);
    };
    const curve = (a, c, b) => {
      const steps = Math.max(2, Math.ceil((Math.hypot(c.x - a.x, c.y - a.y) + Math.hypot(b.x - c.x, b.y - c.y)) / 10));
      for (let i = 0; i < steps; i += 1) {
        const t = i / steps;
        const u = 1 - t;
        out.push([u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y]);
      }
    };
    for (const contour of outline.contours) {
      if (contour.length < 2) continue;
      // Start on an on-curve point (or the implied one between two off-curve points).
      const startIndex = contour.findIndex((point) => point.on);
      const points = startIndex > 0 ? [...contour.slice(startIndex), ...contour.slice(0, startIndex)] : contour;
      const start = startIndex >= 0 ? points[0] : { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2, on: true };
      let from = start;
      let control = null;
      for (let i = startIndex >= 0 ? 1 : 0; i <= points.length; i += 1) {
        const point = i === points.length ? start : points[i];
        if (point.on) {
          if (control) curve(from, control, point);
          else line(from, point);
          from = point;
          control = null;
        } else if (control) {
          const mid = { x: (control.x + point.x) / 2, y: (control.y + point.y) / 2, on: true };
          curve(from, control, mid);
          from = mid;
          control = point;
        } else {
          control = point;
        }
      }
    }
    return out;
  }

  // The largest distance from a point of either shape to the nearest point of the other.
  function shapeDistance(a, b) {
    const oneWay = (from, to) => {
      let worst = 0;
      for (const [x, y] of from) {
        let best = Infinity;
        for (const [u, v] of to) best = Math.min(best, (u - x) * (u - x) + (v - y) * (v - y));
        worst = Math.max(worst, best);
      }
      return Math.sqrt(worst);
    };
    return Math.max(oneWay(a, b), oneWay(b, a));
  }

  // In many typefaces one letter is another turned upside down: 9 and 6 in most sans serifs.
  // A letter missing from a run's font is then drawn as its twin turned half a turn, in the
  // font's own weight. The pair is only used when another font of the same typeface has both
  // letters and its two outlines match that way, within 1.2% of the em.
  const TWINS = { 9: "6", 6: "9", u: "n", n: "u", p: "d", d: "p", q: "b", b: "q" };
  const TWIN_TOLERANCE = 12;

  function twinsMatch(source, target) {
    const [x0, y0, x1, y1] = source.bbox;
    const turned = outlineSamples(source).map(([x, y]) => [x0 + x1 - x, y0 + y1 - y]);
    return shapeDistance(turned, outlineSamples(target)) <= TWIN_TOLERANCE;
  }

  function twinFor(level, font, encoder, ch, seenCodes) {
    const twin = TWINS[ch];
    if (!twin || !encoder.has(twin) || !level || !level.fontKeys || !font.typeface) return null;
    const own = glyphOutline(font, encoder.get(twin));
    if (!own) return null;
    for (const key of level.fontKeys()) {
      const other = level.fontFor(key);
      if (!other || other === font || !other.usable || other.typeface !== font.typeface) continue;
      const otherEncoder = encoderFor(other, seenCodes.get(other));
      if (!otherEncoder.has(ch) || !otherEncoder.has(twin)) continue;
      const source = glyphOutline(other, otherEncoder.get(twin));
      const target = glyphOutline(other, otherEncoder.get(ch));
      if (!source || !target || !twinsMatch(source, target)) continue;
      // Turned about the centre of its own box, the twin keeps the same box and advance.
      const [x0, y0, x1, y1] = own.bbox;
      return { code: encoder.get(twin), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    }
    return null;
  }

  function glyphWidth(font, code) {
    if (font.widths.has(code)) return font.widths.get(code);
    if (font.standard && !font.twoByte) {
      const ch = winAnsiChar(code);
      if (ch) {
        try {
          return font.standard.widthOfTextAtSize(ch, 1000);
        } catch {
          return font.defaultWidth || 500;
        }
      }
    }
    return font.defaultWidth || (font.twoByte ? 1000 : 500);
  }

  // Characters this font can draw, each mapped to its code. A subset font only has the glyphs the
  // document used, so only its ToUnicode entries count; a full font with a standard encoding can
  // draw the whole WinAnsi set.
  function encoderFor(font, seenCodes) {
    if (font.encoder) return font.encoder;
    const map = new Map();
    if (font.toUnicode) {
      for (const [code, text] of font.toUnicode) {
        if (text.length === 1 && !map.has(text)) map.set(text, code);
      }
    }
    if (!font.twoByte && font.winAnsi) {
      if (!font.subset) {
        for (let code = 32; code < 256; code += 1) {
          const ch = charForCode(font, code);
          if (ch && !map.has(ch)) map.set(ch, code);
        }
      } else if (!font.toUnicode) {
        for (const code of seenCodes || []) {
          const ch = charForCode(font, code);
          if (ch && !map.has(ch)) map.set(ch, code);
        }
      }
    }
    font.encoder = map;
    return map;
  }

  // ---- Interpreter ---------------------------------------------------------------------------

  function multiply(m1, m2) {
    return [
      m1[0] * m2[0] + m1[1] * m2[2],
      m1[0] * m2[1] + m1[1] * m2[3],
      m1[2] * m2[0] + m1[3] * m2[2],
      m1[2] * m2[1] + m1[3] * m2[3],
      m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
      m1[4] * m2[1] + m1[5] * m2[3] + m2[5],
    ];
  }

  function point(m, x, y) {
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  }

  function splitCodes(font, bytes) {
    const codes = [];
    if (font.twoByte) {
      for (let i = 0; i + 1 < bytes.length; i += 2) codes.push((bytes.charCodeAt(i) << 8) | bytes.charCodeAt(i + 1));
    } else {
      for (let i = 0; i < bytes.length; i += 1) codes.push(bytes.charCodeAt(i));
    }
    return codes;
  }

  // Walks the page's operators and returns every shown glyph with its position in user space.
  // Walks a content stream and returns every shown glyph with its position in user space. With
  // options.xobjectFor it also walks form XObjects (embedded graphics) drawn with Do, to any depth;
  // each glyph records the level (page or form) whose stream holds it.
  function layoutGlyphs(ops, fontFor, options = {}) {
    const glyphs = options.glyphs || [];
    const seenCodes = options.seenCodes || new Map();
    const level = options.level || { depth: 0, ops };
    const depth = options.depth || 0;
    let gs = options.startState
      ? { ...options.startState }
      : { ctm: [1, 0, 0, 1, 0, 0], font: null, fontKey: "", size: 0, Tc: 0, Tw: 0, Th: 1, TL: 0, rise: 0, fill: [0, 0, 0], Tr: 0, lineWidth: 1, fillOps: "", strokeOps: "" };
    const opText = (op) => (level.source ? level.source.slice(op.start, op.end) : "");
    const stack = [];
    let tm = [1, 0, 0, 1, 0, 0];
    let tlm = [1, 0, 0, 1, 0, 0];
    // How far the text matrix has moved along the line since the line matrix was last set.
    let lineX = 0;
    const nums = (args) => args.map((a) => (a.t === "num" ? a.v : NaN));
    const newLine = () => {
      tlm = multiply([1, 0, 0, 1, 0, -gs.TL], tlm);
      tm = tlm;
      lineX = 0;
    };
    const show = (elements, opIndex) => {
      const font = gs.font;
      if (!font || !gs.size) return;
      const state = {
        size: gs.size, Tc: gs.Tc, Tw: gs.Tw, Th: gs.Th, font, fontKey: gs.fontKey, fill: gs.fill,
        Tr: gs.Tr, lineWidth: gs.lineWidth, fillOps: gs.fillOps, strokeOps: gs.strokeOps,
        // How large one text-space unit is in the current user space, for line widths.
        textScale: Math.hypot(tm[2], tm[3]) || 1,
      };
      elements.forEach((element, elementIndex) => {
        if (element.t === "num") {
          tm = multiply([1, 0, 0, 1, (-element.v / 1000) * gs.size * gs.Th, 0], tm);
          lineX += (-element.v / 1000) * gs.size * gs.Th;
          return;
        }
        if (element.t !== "str") return;
        const codes = splitCodes(font, element.v);
        if (!seenCodes.has(font)) seenCodes.set(font, new Set());
        codes.forEach((code, codeIndex) => {
          seenCodes.get(font).add(code);
          const trm = multiply(multiply([gs.size * gs.Th, 0, 0, gs.size, 0, gs.rise], tm), gs.ctm);
          const width = glyphWidth(font, code) / 1000;
          const tx = (width * gs.size + gs.Tc + (!font.twoByte && code === 32 ? gs.Tw : 0)) * gs.Th;
          const [x, y] = point(trm, 0, 0);
          const [x2] = point(multiply([1, 0, 0, 1, tx, 0], multiply(tm, gs.ctm)), 0, gs.rise);
          glyphs.push({
            level,
            opIndex,
            elementIndex,
            codeIndex,
            code,
            x,
            y,
            end: x2,
            tx,
            tlm,
            lineX,
            rise: gs.rise,
            upright: Math.abs(trm[1]) < 1e-3 * Math.abs(trm[0]) && Math.abs(trm[2]) < 1e-3 * Math.abs(trm[3]) && trm[0] > 0 && trm[3] > 0,
            state,
          });
          tm = multiply([1, 0, 0, 1, tx, 0], tm);
          lineX += tx;
        });
      });
    };
    ops.forEach((op, opIndex) => {
      const a = op.args;
      switch (op.op) {
        case "q":
          stack.push({ ...gs });
          break;
        case "Q":
          if (stack.length) gs = stack.pop();
          break;
        case "cm": {
          const m = nums(a);
          if (m.length === 6 && m.every(Number.isFinite)) gs.ctm = multiply(m, gs.ctm);
          break;
        }
        case "BT":
          tm = [1, 0, 0, 1, 0, 0];
          tlm = tm;
          lineX = 0;
          break;
        case "Tf":
          gs.fontKey = a[0] && a[0].t === "name" ? a[0].v : "";
          gs.font = fontFor(gs.fontKey);
          gs.size = a[1] && a[1].t === "num" ? a[1].v : 0;
          break;
        // Fill colour, so a change drawn in a standard font keeps the original colour. Gray,
        // RGB, and CMYK fills are read; other colour spaces keep the last known colour.
        case "Tr":
          gs.Tr = nums(a)[0] || 0;
          break;
        case "w":
          gs.lineWidth = nums(a)[0] ?? 1;
          break;
        case "G":
        case "RG":
        case "K":
        case "SC":
        case "SCN":
          gs.strokeOps = `${op.op === "SC" || op.op === "SCN" ? gs.strokeSpace || "" : ""}${opText(op)}`;
          break;
        case "CS":
          gs.strokeSpace = `${opText(op)} `;
          gs.strokeOps = gs.strokeSpace;
          break;
        case "cs":
          gs.fillSpace = `${opText(op)} `;
          gs.fillOps = gs.fillSpace;
          break;
        case "g":
        case "rg":
        case "k":
        case "sc":
        case "scn": {
          gs.fillOps = `${op.op === "sc" || op.op === "scn" ? gs.fillSpace || "" : ""}${opText(op)}`;
          const v = nums(a).filter(Number.isFinite);
          if (v.length === 1) gs.fill = [v[0], v[0], v[0]];
          else if (v.length === 3) gs.fill = v;
          else if (v.length === 4) gs.fill = [(1 - v[0]) * (1 - v[3]), (1 - v[1]) * (1 - v[3]), (1 - v[2]) * (1 - v[3])];
          break;
        }
        case "Tc":
          gs.Tc = nums(a)[0] || 0;
          break;
        case "Tw":
          gs.Tw = nums(a)[0] || 0;
          break;
        case "Tz":
          gs.Th = (nums(a)[0] ?? 100) / 100;
          break;
        case "TL":
          gs.TL = nums(a)[0] || 0;
          break;
        case "Ts":
          gs.rise = nums(a)[0] || 0;
          break;
        case "Td":
        case "TD": {
          const [tx, ty] = nums(a);
          if (op.op === "TD") gs.TL = -ty;
          tlm = multiply([1, 0, 0, 1, tx || 0, ty || 0], tlm);
          tm = tlm;
          lineX = 0;
          break;
        }
        case "Tm": {
          const m = nums(a);
          if (m.length === 6 && m.every(Number.isFinite)) {
            tlm = m;
            tm = m;
            lineX = 0;
          }
          break;
        }
        case "T*":
          newLine();
          break;
        case "Tj":
          show(a.slice(-1), opIndex);
          break;
        case "'":
          newLine();
          show(a.slice(-1), opIndex);
          break;
        case '"': {
          const [aw, ac] = nums(a);
          gs.Tw = aw || 0;
          gs.Tc = ac || 0;
          newLine();
          show(a.slice(-1), opIndex);
          break;
        }
        case "TJ":
          show(a[0] && a[0].t === "arr" ? a[0].v : [], opIndex);
          break;
        case "Do": {
          const form = options.xobjectFor && a[0] && a[0].t === "name" && depth < 8 ? options.xobjectFor(a[0].v) : null;
          if (form) {
            const child = { depth: depth + 1, ops: form.ops, source: form.source, form, parent: level, parentOpIndex: opIndex, extra: [], adds: [], fontFor: form.fontFor, fontKeys: form.fontKeys };
            layoutGlyphs(form.ops, form.fontFor, {
              xobjectFor: form.xobjectFor,
              level: child,
              depth: depth + 1,
              startState: { ...gs, ctm: multiply(form.matrix, gs.ctm) },
              glyphs,
              seenCodes,
            });
          }
          break;
        }
        default:
          break;
      }
    });
    return { glyphs, seenCodes };
  }

  // ---- Rewriting -----------------------------------------------------------------------------

  function formatNumber(value) {
    const text = (Math.round(value * 10000) / 10000).toString();
    return text === "-0" ? "0" : text;
  }

  function hexString(bytes) {
    let out = "<";
    for (let i = 0; i < bytes.length; i += 1) out += bytes.charCodeAt(i).toString(16).padStart(2, "0");
    return `${out}>`;
  }

  function codeBytes(font, code) {
    return font.twoByte ? String.fromCharCode((code >> 8) & 255, code & 255) : String.fromCharCode(code & 255);
  }

  // Encodes text for a font: returns [{ code } | { gap }] or null when a letter is missing.
  // A space the font can't draw becomes a gap the width of a space.
  function encodeText(font, encoder, text) {
    const parts = [];
    for (const ch of text) {
      if (encoder.has(ch)) parts.push({ code: encoder.get(ch) });
      else if (ch === " ") parts.push({ gap: font.twoByte ? 250 : glyphWidth(font, 32) || 250 });
      else return null;
    }
    return parts;
  }

  // Letters of a kind (digits, capitals, small letters, the rest) share proportions, so a width
  // ratio between two fonts is measured on letters of the same kind where there are enough.
  function letterKind(ch) {
    if (/\p{Nd}/u.test(ch)) return "digit";
    if (/\p{Lu}/u.test(ch)) return "upper";
    if (/\p{Ll}/u.test(ch)) return "lower";
    return "other";
  }

  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length ? sorted[(sorted.length - 1) >> 1] : NaN;
  }

  // How much wider the run's font draws a letter than another font does, from the letters both
  // have: { all, digit, upper, lower, other } medians. widthOf(ch) is the other font's width.
  function widthRatios(font, encoder, widthOf) {
    const byKind = { all: [] };
    for (const [ch, code] of encoder) {
      if (ch === " " || ch === "\u00a0") continue;
      const mine = glyphWidth(font, code);
      const theirs = widthOf(ch);
      if (!(mine > 0 && theirs > 0)) continue;
      const kind = letterKind(ch);
      (byKind[kind] = byKind[kind] || []).push(mine / theirs);
      byKind.all.push(mine / theirs);
    }
    const ratios = {};
    for (const [kind, values] of Object.entries(byKind)) ratios[kind] = median(values);
    ratios.count = byKind.all.length;
    ratios.for = (ch) => {
      const kind = byKind[letterKind(ch)];
      const value = kind && kind.length >= 2 ? ratios[letterKind(ch)] : ratios.all;
      return Math.min(1.25, Math.max(0.8, value));
    };
    return ratios;
  }

  // PDF makers embed only the letters each style uses, so a letter missing from a run's font is
  // often in another subset of the same typeface: another weight, or the same one. Each such font
  // is a candidate if its widths agree with the run's (the same design), and if it is lighter, the
  // same, or at most 15% heavier. A lighter letter is drawn thicker, its outline stroked by the
  // stem difference; every borrowed letter is scaled by the width ratio for its kind of letter.
  // Closest weight first.
  function siblingsOf(level, font, encoder, seenCodes) {
    if (!level || !level.fontKeys || !font.typeface) return [];
    const out = [];
    for (const key of level.fontKeys()) {
      const other = level.fontFor(key);
      if (!other || other === font || !other.usable || other.typeface !== font.typeface) continue;
      const otherEncoder = encoderFor(other, seenCodes.get(other));
      const ratios = widthRatios(font, encoder, (ch) => (otherEncoder.has(ch) ? glyphWidth(other, otherEncoder.get(ch)) : 0));
      if (ratios.count < 2 || ratios.all < 0.8 || ratios.all > 1.25) continue;
      const stemDelta = font.stemV > 0 && other.stemV > 0 ? font.stemV - other.stemV : 0;
      if (stemDelta < -0.15 * font.stemV) continue;
      const exact = Math.abs(stemDelta) <= 0.05 * (font.stemV || 1) && Math.abs(ratios.all - 1) < 0.02;
      out.push({
        key,
        font: other,
        encoder: otherEncoder,
        ratios,
        exact,
        extraStem: exact ? 0 : Math.max(0, stemDelta),
        distance: Math.abs(stemDelta),
      });
    }
    return out.sort((a, b) => a.distance - b.distance);
  }

  // A letter taken from another font, drawn by rewriteOp between the run's own letters.
  function borrowedPart(sibling, ch) {
    const code = sibling.encoder.get(ch);
    return {
      borrow: {
        key: sibling.key,
        bytes: codeBytes(sibling.font, code),
        width: glyphWidth(sibling.font, code),
        ratio: sibling.exact ? 1 : sibling.ratios.for(ch),
        extraStem: sibling.extraStem,
        borrowed: true,
      },
    };
  }

  // Like encodeText, for letters the run's font doesn't have. Each missing letter is taken from,
  // in order: a subset of the same weight; the font's own upside-down twin (twinFor); the closest
  // weight of the same typeface, adjusted; a free font from the site's library matched to this one
  // (libraryFor); a standard font, scaled to the run's proportions (standardFor). Only the missing
  // letters change; the rest stay in the run's font.
  function encodeWithSiblings(font, encoder, text, siblings, twinOf, libraryFor, standardFor) {
    const parts = [];
    for (const ch of text) {
      if (encoder.has(ch)) parts.push({ code: encoder.get(ch) });
      else if (ch === " " || (ch === "\u00a0" && !encoder.has(ch))) parts.push({ gap: font.twoByte ? 250 : glyphWidth(font, 32) || 250 });
      else {
        const exact = siblings.find((candidate) => candidate.exact && candidate.encoder.has(ch));
        const twin = exact ? null : twinOf(ch);
        const nearest = exact || twin ? null : siblings.find((candidate) => candidate.encoder.has(ch));
        const library = exact || twin || nearest ? null : libraryFor(ch);
        const standard = exact || twin || nearest || library ? null : standardFor(ch);
        if (exact || nearest) parts.push(borrowedPart(exact || nearest, ch));
        else if (twin) parts.push({ code: twin.code, twin: { ...twin, letter: ch } });
        else if (library) parts.push(library);
        else if (standard) parts.push(standard);
        else return null;
      }
    }
    return parts;
  }

  // For a font that doesn't allow editing: every letter an edit adds comes from the library or a
  // standard font, none from the font itself or its other subsets.
  function encodeElsewhere(font, text, libraryFor, standardFor) {
    const parts = [];
    for (const ch of text) {
      if (ch === " " || ch === "\u00a0") parts.push({ gap: font.twoByte ? 250 : glyphWidth(font, 32) || 250 });
      else {
        const part = libraryFor(ch) || standardFor(ch);
        if (!part) return null;
        parts.push(part);
      }
    }
    return parts;
  }

  // What the font library sees of a PDF font: its name, descriptor, and the widths of the letters
  // it has (in 1000-unit glyph space, the same as the library's). Subsets of one typeface share
  // a key, so their letters are matched together.
  function libraryInfo(font, encoder) {
    const widths = {};
    for (const [ch, code] of encoder) {
      const width = glyphWidth(font, code);
      if (width > 0 && [...ch].length === 1) widths[ch] = width;
    }
    return {
      key: `${font.typeface}|${font.flags & (1 | 2 | 8 | 64)}`,
      typeface: font.typeface,
      baseFont: font.baseFont,
      flags: font.flags || 0,
      italicAngle: font.italicAngle || 0,
      capHeight: font.capHeight || 0,
      xHeight: font.xHeight || 0,
      stemV: font.stemV || 0,
      widths,
    };
  }

  // The fill colour operators, turned into the matching stroke colour operators.
  function strokeFromFill(fillOps) {
    const map = { rg: "RG", g: "G", k: "K", cs: "CS", sc: "SC", scn: "SCN" };
    const tokens = String(fillOps || "").trim().split(/\s+/).filter(Boolean);
    return tokens.length ? tokens.map((token) => map[token] || token).join(" ") : "0 G";
  }

  function glyphsOfRun(glyphs, run) {
    const tolerance = Math.max(1, run.fontSize * 0.35);
    return glyphs.filter((glyph) => {
      if (!glyph.upright || !glyph.state.font.usable) return false;
      if (Math.abs(glyph.y - run.baseline) > tolerance) return false;
      const center = (glyph.x + glyph.end) / 2;
      return center >= run.x - 0.5 && center <= run.x + run.width + 0.5;
    });
  }

  // Rewrites one text-showing operator. `removed` holds the glyph keys to drop; `insert` puts the
  // new text in place of the first removed glyph. Shifts are padded so the glyphs after the edit
  // land exactly where they were.
  function rewriteOp(op, opGlyphs, removed, insert) {
    const first = opGlyphs[0];
    if (!first) return null;
    const { size, Th, Tc, Tw, font } = first.state;
    const unit = size * Th;
    if (!unit) return null;
    const elements = op.op === "TJ" ? (op.args[0] && op.args[0].v) || [] : op.args.slice(-1);
    const segments = [];
    const out = [];
    let pending = 0;
    let current = "";
    const flushText = () => {
      if (current) out.push(hexString(current));
      current = "";
    };
    const flushShift = () => {
      if (Math.abs(pending) > 1e-6) {
        flushText();
        out.push(formatNumber((-pending * 1000) / unit));
      }
      pending = 0;
    };
    const byPosition = new Map(opGlyphs.map((glyph) => [`${glyph.elementIndex}:${glyph.codeIndex}`, glyph]));
    elements.forEach((element, elementIndex) => {
      if (element.t === "num") {
        flushText();
        pending -= (element.v / 1000) * unit;
        flushShift();
        return;
      }
      if (element.t !== "str") return;
      const codes = splitCodes(font, element.v);
      codes.forEach((code, codeIndex) => {
        const key = `${elementIndex}:${codeIndex}`;
        const glyph = byPosition.get(key);
        if (glyph && removed.has(glyph)) {
          if (insert && insert.at === glyph) {
            flushShift();
            for (const part of insert.parts) {
              if (part.gap) {
                flushText();
                out.push(formatNumber(-part.gap));
                pending -= (part.gap / 1000) * size * Th;
              } else if (part.borrow) {
                // Close the main TJ, draw the borrowed letter, then restore the run's state.
                flushText();
                segments.push(`[${out.join(" ")}] TJ`);
                out.length = 0;
                const borrow = part.borrow;
                const state = first.state;
                const scaled = Th * borrow.ratio;
                let draw = `/${borrow.key} ${formatNumber(size)} Tf`;
                let restore = `/${state.fontKey} ${formatNumber(size)} Tf`;
                if (borrow.ratio !== 1) {
                  draw += ` ${formatNumber(scaled * 100)} Tz`;
                  restore += ` ${formatNumber(Th * 100)} Tz`;
                }
                if (borrow.extraStem) {
                  const width = (borrow.extraStem / 1000) * size * state.textScale;
                  draw += ` 2 Tr ${formatNumber(width)} w ${strokeFromFill(state.fillOps)}`;
                  restore += ` ${formatNumber(state.Tr)} Tr ${formatNumber(state.lineWidth)} w ${state.strokeOps || "0 G"}`;
                }
                segments.push(`${draw} [${hexString(borrow.bytes)}] TJ ${restore}`);
                const drawn = ((borrow.width / 1000) * size + Tc) * scaled;
                // A kept letter moves on by its original advance, not its drawn width.
                if (part.advance !== undefined && Math.abs(part.advance - drawn) > 1e-6) out.push(formatNumber((-(part.advance - drawn) * 1000) / unit));
                pending -= part.advance ?? drawn;
              } else if (part.twin) {
                // Close the main TJ and draw the twin turned half a turn about the centre of its
                // box, with a text matrix. Setting the text matrix also sets the line matrix, so
                // the line matrix is put back and a shift moves on to where the twin ends.
                flushText();
                segments.push(`[${out.join(" ")}] TJ`);
                out.length = 0;
                const { tlm, rise } = insert.at;
                const along = insert.at.lineX - pending;
                const advance = ((glyphWidth(font, part.code) / 1000) * size + Tc) * Th;
                const turned = multiply([-1, 0, 0, -1, along + ((2 * part.twin.cx) / 1000) * size * Th, 2 * ((part.twin.cy / 1000) * size + rise)], tlm);
                // ActualText makes copying and searching read the letter typed, not its twin.
                const glyphText = `${turned.map(formatNumber).join(" ")} Tm [${hexString(codeBytes(font, part.code))}] TJ`;
                segments.push(`/Span <</ActualText ${utf16Hex(part.twin.letter)}>> BDC ${glyphText} EMC ${tlm.map(formatNumber).join(" ")} Tm`);
                out.push(formatNumber((-(along + advance) * 1000) / unit));
                pending -= advance;
              } else {
                current += codeBytes(font, part.code);
                const drawn = (glyphWidth(font, part.code) / 1000 * size + Tc + (!font.twoByte && part.code === 32 ? Tw : 0)) * Th;
                // A kept letter moves on by its original advance, not its drawn width.
                if (part.advance !== undefined && Math.abs(part.advance - drawn) > 1e-6) {
                  flushText();
                  out.push(formatNumber((-(part.advance - drawn) * 1000) / unit));
                }
                pending -= part.advance ?? drawn;
              }
            }
            flushText();
          }
          pending += glyph.tx;
          return;
        }
        flushShift();
        current += codeBytes(font, code);
      });
    });
    flushShift();
    flushText();
    segments.push(`[${out.join(" ")}] TJ`);
    const array = segments.filter((segment) => segment !== "[] TJ").join(" ") || "[] TJ";
    if (op.op === "'") return `T* ${array}`;
    if (op.op === '"') {
      const [aw, ac] = op.args.map((arg) => (arg.t === "num" ? arg.v : 0));
      return `${formatNumber(aw)} Tw ${formatNumber(ac)} Tc T* ${array}`;
    }
    return array;
  }

  function pageContentString(L, doc, page) {
    const contents = page.node.Contents();
    if (!contents) return "";
    const streams = typeof contents.size === "function" ? Array.from({ length: contents.size() }, (_, i) => contents.lookup(i)) : [contents];
    const parts = [];
    for (const stream of streams) {
      const text = streamText(L, stream);
      if (text === null) return null;
      parts.push(text);
    }
    return parts.join("\n");
  }

  // Fonts and form XObjects available to one content stream, from its Resources dictionary.
  function resourceContext(L, doc, resources, cache) {
    const fontCache = new Map();
    const fonts = lookup(L, resources, "Font");
    const xobjects = lookup(L, resources, "XObject");
    const fontFor = (key) => {
      if (!fontCache.has(key)) {
        let font = null;
        try {
          const dict = lookup(L, fonts, key);
          font = dict ? cachedFont(L, dict, cache) : null;
        } catch {
          font = null;
        }
        fontCache.set(key, font);
      }
      return fontCache.get(key);
    };
    const xobjectFor = (name) => {
      try {
        const stream = lookup(L, xobjects, name);
        if (!stream || !stream.dict || nameOf(lookup(L, stream.dict, "Subtype")) !== "Form") return null;
        if (!cache.forms.has(stream)) {
          const source = streamText(L, stream);
          if (source === null) return null;
          const own = lookup(L, stream.dict, "Resources");
          const matrixArray = lookup(L, stream.dict, "Matrix");
          const matrix =
            matrixArray && typeof matrixArray.size === "function" && matrixArray.size() === 6
              ? Array.from({ length: 6 }, (_, i) => numberOf(L, matrixArray.lookup(i)) ?? 0)
              : [1, 0, 0, 1, 0, 0];
          cache.forms.set(stream, { stream, source, ops: parseOps(source), matrix, ownResources: own || null, resources: own || resources });
        }
        const form = cache.forms.get(stream);
        return { ...form, ...resourceContext(L, doc, form.resources, cache) };
      } catch {
        return null;
      }
    };
    const fontKeys = () => (fonts && typeof fonts.keys === "function" ? fonts.keys().map((key) => nameOf(key)) : []);
    return { fontFor, fontKeys, xobjectFor, resources };
  }

  function cachedFont(L, dict, cache) {
    if (!cache.fonts.has(dict)) cache.fonts.set(dict, readFont(L, dict));
    return cache.fonts.get(dict);
  }

  function decodePdfText(bytes) {
    if (bytes.charCodeAt(0) === 0xfe && bytes.charCodeAt(1) === 0xff) {
      let out = "";
      for (let i = 2; i + 1 < bytes.length; i += 2) out += String.fromCharCode((bytes.charCodeAt(i) << 8) | bytes.charCodeAt(i + 1));
      return out;
    }
    return bytes;
  }

  function utf16Hex(text) {
    let out = "<FEFF";
    for (let i = 0; i < text.length; i += 1) out += text.charCodeAt(i).toString(16).padStart(4, "0");
    return `${out}>`;
  }

  // Marked-content properties written in the stream itself (BDC/DP), such as ActualText and Alt
  // for screen readers, can repeat the visible words. They are rewritten with scrub(text).
  function scrubMarkedContent(ops, scrub) {
    const replacements = [];
    const walk = (items) => {
      for (const item of items) {
        if (item.t === "str") {
          const text = decodePdfText(item.v);
          const next = scrub(text);
          if (next !== text) replacements.push({ start: item.start, end: item.end, text: utf16Hex(next) });
        } else if (item.t === "dict" || item.t === "arr") {
          walk(item.v);
        }
      }
    };
    for (const op of ops) if (op.op === "BDC" || op.op === "DP") walk(op.args);
    return replacements;
  }

  function splice(source, replacements) {
    const ordered = [...replacements].sort((a, b) => a.start - b.start);
    let output = "";
    let at = 0;
    for (const item of ordered) {
      if (item.start < at) continue;
      output += source.slice(at, item.start) + item.text;
      at = item.end;
    }
    return output + source.slice(at);
  }

  function setPageContent(L, doc, page, text) {
    page.node.set(L.PDFName.of("Contents"), doc.context.register(doc.context.flateStream(stringToBytes(text))));
  }

  function freshName(L, dict, taken, prefix = "Fm") {
    for (let n = 1; ; n += 1) {
      const name = `${prefix}${n}`;
      if (!taken.has(name) && !(dict && dict.has(L.PDFName.of(name)))) {
        taken.add(name);
        return name;
      }
    }
  }

  // The letter a glyph draws, or null when that isn't known.
  function glyphLetter(glyph) {
    const font = glyph.state.font;
    if (font.toUnicode && font.toUnicode.has(glyph.code)) return font.toUnicode.get(glyph.code);
    return font.twoByte ? null : charForCode(font, glyph.code) || null;
  }

  const sameLetter = (a, b) => a === b || (/\s/.test(a) && /\s/.test(b));

  // Only the part of a run that changed is laid out again. The run's glyphs are paired with the
  // letters of its original text (spaces between glyphs are often only a move, with no glyph);
  // the letters the old and new text share at the start and the end keep their glyphs and their
  // exact original advances, gaps included, so they stay where they were, and only the middle is
  // written fresh. The letters after it move by however much wider or narrower the middle is.
  // Returns { before, middle, after, anchor }, where before and after are parts and middle is the
  // new text between them, or null when the glyphs can't be paired with the text (the whole run is
  // then written fresh).
  function keepUnchanged(matched, original, text, first) {
    if (typeof original !== "string") return null;
    const old = Array.from(original);
    const now = Array.from(text);
    const letters = matched.map(glyphLetter);
    const owner = [];
    let next = 0;
    for (const ch of old) {
      if (next < matched.length && letters[next] !== null && sameLetter(letters[next], ch)) owner.push(next++);
      else if (/\s/.test(ch)) owner.push(-1);
      else return null;
    }
    if (next !== matched.length) return null;
    const { size, rise } = first.state;
    if (matched.some((glyph) => glyph.state.size !== size || glyph.state.rise !== rise)) return null;

    let start = 0;
    while (start < old.length && start < now.length && old[start] === now[start]) start += 1;
    let tail = 0;
    while (tail < old.length - start && tail < now.length - start && old[old.length - 1 - tail] === now[now.length - 1 - tail]) tail += 1;
    if (start === old.length && start === now.length) return null;

    // Text-space units per unit of page space along the line, from the glyphs' own advances.
    const scales = matched.filter((glyph) => glyph.tx > 0 && glyph.end > glyph.x).map((glyph) => glyph.tx / (glyph.end - glyph.x));
    const toText = median(scales);
    if (!(toText > 0)) return null;
    const unit = size * first.state.Th;
    const glyphAt = (index) => (index >= 0 && index < old.length && owner[index] >= 0 ? matched[owner[index]] : null);
    const nextGlyphIndex = (index) => {
      for (let k = index + 1; k < old.length; k += 1) if (owner[k] >= 0) return k;
      return -1;
    };
    // A kept glyph, with its advance to the next glyph when everything up to that glyph is kept
    // too (the gap after it belongs to the kept text), or else its own width.
    const keep = (index, keptUpTo) => {
      const glyph = glyphAt(index);
      const following = nextGlyphIndex(index);
      const advance = following >= 0 && following <= keptUpTo ? (glyphAt(following).x - glyph.x) * toText : glyph.tx;
      const font = glyph.state.font;
      if (font === first.state.font) return { code: glyph.code, advance };
      return { borrow: { key: glyph.state.fontKey, bytes: codeBytes(font, glyph.code), width: glyphWidth(font, glyph.code), ratio: 1, extraStem: 0 }, advance };
    };
    const before = [];
    for (let index = 0; index < start; index += 1) {
      if (owner[index] >= 0) before.push(keep(index, start));
      else {
        // A space with no glyph: covered by the advance of the glyph before it, unless that glyph
        // only advanced by its own width.
        let previous = index - 1;
        while (previous >= 0 && owner[previous] < 0) previous -= 1;
        const following = nextGlyphIndex(index);
        if (previous < 0 || !(following >= 0 && following <= start)) before.push({ gap: 250 });
      }
    }
    const after = [];
    const from = old.length - tail;
    for (let index = from; index < old.length; index += 1) {
      if (owner[index] >= 0) after.push(keep(index, old.length));
      else {
        let previous = index - 1;
        while (previous >= 0 && owner[previous] < 0) previous -= 1;
        if (previous >= from) continue;
        // A gap right after the changed middle keeps its original size.
        const following = nextGlyphIndex(index);
        const left = previous >= 0 ? matched[owner[previous]] : null;
        if (left && following >= 0) {
          const gapText = (glyphAt(following).x - left.end) * toText;
          if (gapText > 0) after.push({ gap: (gapText * 1000) / unit });
        }
      }
    }
    // The middle is written in the font of the first changed glyph, or of the last kept one.
    let anchor = null;
    for (let index = start; index < old.length - tail && !anchor; index += 1) anchor = glyphAt(index);
    for (let index = start - 1; index >= 0 && !anchor; index -= 1) anchor = glyphAt(index);
    if (!anchor) anchor = first;
    return { before, middle: now.slice(start, now.length - tail).join(""), after, anchor };
  }

  // Applies text edits to one page. The edited glyphs are deleted from whichever stream holds them:
  // the page, or a form XObject it draws (a private copy of that form is made for this spot, so the
  // form's other uses are untouched). Each edit gets a result: "replaced" (new text written in the
  // original font), "removed" (original deleted; the caller draws the new text in a standard font),
  // or "missing" (the text couldn't be found in a stream this can rewrite). The streams that held
  // the old text are left unreferenced, and the caller deletes unreferenced objects before saving.
  function editPage(L, doc, page, edits, options) {
    const results = new Map(edits.map((edit) => [edit, "missing"]));
    const colors = new Map();
    const borrowed = new Set();
    const standardLetters = new Set();
    // Edits with letters from the font library; of those, the ones from another family (a font with
    // the same widths, or the closest match) rather than a free copy of the same one; the families
    // used; and edits in a font whose embedding permissions don't allow writing new text with it.
    const libraryLetters = new Set();
    const librarySimilar = new Set();
    const libraryFamilies = new Map();
    const restricted = new Set();
    const outcome = (changed) => ({ results, colors, borrowed, standardLetters, libraryLetters, librarySimilar, libraryFamilies, restricted, changed });
    const source = pageContentString(L, doc, page);
    if (!source) return outcome(false);
    const ops = parseOps(source);
    let resources = page.node.Resources();
    if (!resources) {
      resources = doc.context.obj({});
      page.node.set(L.PDFName.of("Resources"), resources);
    }
    const cache = { fonts: new Map(), forms: new Map() };
    const context = resourceContext(L, doc, resources, cache);
    const root = { depth: 0, ops, source, parent: null, extra: [], adds: [], resources, fontFor: context.fontFor, fontKeys: context.fontKeys };
    const { glyphs, seenCodes } = layoutGlyphs(ops, context.fontFor, { xobjectFor: context.xobjectFor, level: root });
    const dryRun = Boolean(options && options.dryRun);

    // The last resort for one letter no font of the run's typeface has: the closest standard font
    // (options.standardFontName(edit), a pdf-lib StandardFonts key), its width scaled to the run's
    // proportions for that kind of letter. It is added to the resources of the stream it is drawn
    // in. Letters outside the standard fonts' character set return null.
    const standardFonts = new Map();
    const standardLetter = (level, font, encoder, ch, edit) => {
      const fontName = options && options.standardFontName ? options.standardFontName(edit) : null;
      if (!fontName || !L.StandardFonts[fontName]) return null;
      let embedder;
      let bytes;
      try {
        embedder = L.StandardFontEmbedder.for(L.StandardFonts[fontName]);
        bytes = String.fromCharCode(...embedder.encodeText(ch).asBytes());
      } catch {
        return null;
      }
      if (!bytes) return null;
      const widthOf = (letter) => {
        try {
          return embedder.widthOfTextAtSize(letter, 1000);
        } catch {
          return 0;
        }
      };
      const ratios = widthRatios(font, encoder, widthOf);
      if (!level.standardKeys) level.standardKeys = new Map();
      if (!level.standardKeys.has(fontName)) {
        const dict = lookup(L, level.depth === 0 ? resources : level.form.resources, "Font");
        if (!level.takenFonts) level.takenFonts = new Set(level.fontKeys ? level.fontKeys() : []);
        const key = freshName(L, dict, level.takenFonts, "StdF");
        let ref = null;
        if (!dryRun) {
          if (!standardFonts.has(fontName)) standardFonts.set(fontName, doc.embedStandardFont(L.StandardFonts[fontName]).ref);
          ref = standardFonts.get(fontName);
        }
        level.standardKeys.set(fontName, { key, ref });
      }
      return {
        borrow: {
          key: level.standardKeys.get(fontName).key,
          bytes,
          width: widthOf(ch),
          ratio: ratios.count >= 2 ? ratios.for(ch) : 1,
          extraStem: 0,
          standard: true,
        },
      };
    };
    // A letter from the site's font library (options.library, see font-library.js), matched to the
    // run's font: the same family by name, a free font with the same widths, or the closest one.
    // Scaled by the width ratio like a standard letter, so it fits the run's proportions. In a dry
    // run the library may be a collector that only records which letters are needed.
    const library = options && options.library;
    const libraryLetter = (level, font, encoder, ch, edit) => {
      if (!library) return null;
      if (!font.libraryInfo) font.libraryInfo = libraryInfo(font, encoder);
      const info = font.libraryInfo;
      const glyph = library.glyph(info, ch);
      if (!glyph) return null;
      const id = `library:${glyph.file ? glyph.file.url : "pending"}`;
      if (!level.standardKeys) level.standardKeys = new Map();
      if (!level.standardKeys.has(id)) {
        const dict = lookup(L, level.depth === 0 ? resources : level.form.resources, "Font");
        if (!level.takenFonts) level.takenFonts = new Set(level.fontKeys ? level.fontKeys() : []);
        const key = freshName(L, dict, level.takenFonts, "LibF");
        const ref = !dryRun && glyph.file ? library.embed(L, doc, glyph.file) : null;
        level.standardKeys.set(id, { key, ref });
      }
      const ratios = widthRatios(font, encoder, (letter) => library.widthOf(info, letter));
      if (glyph.family) {
        if (!libraryFamilies.has(edit)) libraryFamilies.set(edit, new Set());
        libraryFamilies.get(edit).add(glyph.family);
      }
      return {
        borrow: {
          key: level.standardKeys.get(id).key,
          bytes: String.fromCharCode((glyph.gid >> 8) & 255, glyph.gid & 255),
          width: glyph.width,
          ratio: ratios.count >= 2 ? ratios.for(ch) : 1,
          extraStem: 0,
          library: glyph.kind,
        },
      };
    };
    const removed = new Set();
    const inserts = [];
    for (const edit of edits) {
      const matched = glyphsOfRun(glyphs, edit).filter((glyph) => !removed.has(glyph));
      if (!matched.length) continue;
      matched.forEach((glyph) => removed.add(glyph));
      const first = matched[0];
      colors.set(edit, first.state.fill.map((value) => Math.min(1, Math.max(0, value))));
      const text = (edit.text || "").replace(/[\r\n]+/g, " ");
      // New letters are written in the font of the first changed letter. Letters missing from it
      // come from elsewhere (see encodeWithSiblings).
      const encodeIn = (anchor, letters) => {
        const font = anchor.state.font;
        const encoder = encoderFor(font, seenCodes.get(font));
        const libraryFor = (ch) => libraryLetter(anchor.level, font, encoder, ch, edit);
        const standardFor = (ch) => standardLetter(anchor.level, font, encoder, ch, edit);
        let encoded;
        if (letters && editingRestricted(font)) {
          restricted.add(edit);
          encoded = encodeElsewhere(font, letters, libraryFor, standardFor);
        } else {
          encoded = letters ? encodeText(font, encoder, letters) : [];
        }
        if (!encoded && !restricted.has(edit)) {
          // A turned twin is drawn in the operator's own font, so only when that is this font.
          const twinOf = (ch) => (font === first.state.font ? twinFor(anchor.level, font, encoder, ch, seenCodes) : null);
          encoded = encodeWithSiblings(font, encoder, letters, siblingsOf(anchor.level, font, encoder, seenCodes), twinOf, libraryFor, standardFor);
        }
        if (!encoded || font === first.state.font) return encoded;
        // Another font than the operator's: its letters are drawn like borrowed ones.
        return encoded.map((part) =>
          part.code === undefined || part.borrow
            ? part
            : { borrow: { key: anchor.state.fontKey, bytes: codeBytes(font, part.code), width: glyphWidth(font, part.code), ratio: 1, extraStem: 0 } },
        );
      };
      const plan = keepUnchanged(matched, edit.original, text, first);
      let parts = null;
      if (plan) {
        const middle = encodeIn(plan.anchor, plan.middle);
        if (middle) parts = [...plan.before, ...middle, ...plan.after];
      } else {
        parts = encodeIn(first, text);
      }
      if (parts && parts.some((part) => part.borrow && part.borrow.borrowed)) borrowed.add(edit);
      if (parts && parts.some((part) => part.borrow && part.borrow.standard)) standardLetters.add(edit);
      if (parts && parts.some((part) => part.borrow && part.borrow.library)) libraryLetters.add(edit);
      if (parts && parts.some((part) => part.borrow && part.borrow.library && part.borrow.library !== "same")) librarySimilar.add(edit);
      if (parts) {
        if (parts.length) inserts.push({ at: first, parts });
        results.set(edit, "replaced");
      } else {
        results.set(edit, "removed");
      }
    }
    if (!removed.size || dryRun) return outcome(false);

    // Every stream that held an edited glyph is rewritten, and so is each stream above it, which
    // has to point at the rewritten copy. Deepest first.
    const touched = new Set();
    for (const glyph of removed) {
      for (let level = glyph.level; level && !touched.has(level); level = level.parent) touched.add(level);
    }
    const levels = [...touched].sort((a, b) => b.depth - a.depth);
    for (const level of levels) {
      const replacements = [...level.extra];
      const byOp = new Map();
      for (const glyph of glyphs) {
        if (glyph.level !== level) continue;
        if (!byOp.has(glyph.opIndex)) byOp.set(glyph.opIndex, []);
        byOp.get(glyph.opIndex).push(glyph);
      }
      for (const [opIndex, opGlyphs] of byOp) {
        if (!opGlyphs.some((glyph) => removed.has(glyph))) continue;
        const insert = inserts.find((item) => item.at.level === level && item.at.opIndex === opIndex) || null;
        const text = rewriteOp(level.ops[opIndex], opGlyphs, removed, insert);
        if (text !== null) replacements.push({ start: level.ops[opIndex].start, end: level.ops[opIndex].end, text });
      }
      if (options && options.scrub) replacements.push(...scrubMarkedContent(level.ops, options.scrub));
      const output = splice(level.source, replacements);

      // This level now draws private copies instead of some forms. Its resources get the copies
      // and lose the names it no longer draws, so the old forms (and the old text in them) stop
      // being referenced and are deleted on save. The resources are copied first, because they
      // can be shared with other pages that still draw the originals.
      const ownResourcesFor = (base) => {
        if (!level.adds.length && !level.standardKeys) return null;
        const own = base.clone(doc.context);
        if (level.standardKeys) {
          const existingFonts = lookup(L, own, "Font");
          const fonts = existingFonts ? existingFonts.clone(doc.context) : doc.context.obj({});
          for (const { key, ref } of level.standardKeys.values()) fonts.set(L.PDFName.of(key), ref);
          own.set(L.PDFName.of("Font"), fonts);
        }
        const existing = lookup(L, own, "XObject");
        const xobjects = existing ? existing.clone(doc.context) : doc.context.obj({});
        for (const [name, ref] of level.adds) xobjects.set(L.PDFName.of(name), ref);
        const stillDrawn = new Set(parseOps(output).filter((op) => op.op === "Do" && op.args[0]).map((op) => op.args[0].v));
        for (const name of level.replacedNames || []) {
          if (!stillDrawn.has(name)) xobjects.delete(L.PDFName.of(name));
        }
        own.set(L.PDFName.of("XObject"), xobjects);
        return own;
      };

      if (level.depth === 0) {
        const own = ownResourcesFor(resources);
        if (own) page.node.set(L.PDFName.of("Resources"), own);
        setPageContent(L, doc, page, output);
        continue;
      }
      // A private copy of this form with the rewritten content; its parent draws the copy instead.
      const form = level.form;
      const entries = {};
      for (const [key, value] of form.stream.dict.entries()) {
        const name = nameOf(key);
        if (name !== "Length" && name !== "Filter" && name !== "DecodeParms") entries[name] = value;
      }
      const own = ownResourcesFor(form.resources);
      if (own) entries.Resources = own;
      const ref = doc.context.register(doc.context.flateStream(stringToBytes(output), entries));
      const parent = level.parent;
      if (!parent.taken) parent.taken = new Set();
      const parentResources = parent.depth === 0 ? resources : parent.form.resources;
      const name = freshName(L, lookup(L, parentResources, "XObject"), parent.taken);
      parent.adds.push([name, ref]);
      if (!parent.replacedNames) parent.replacedNames = new Set();
      parent.replacedNames.add(parent.ops[level.parentOpIndex].args[0].v);
      const call = parent.ops[level.parentOpIndex];
      parent.extra.push({ start: call.start, end: call.end, text: `/${name} Do` });
    }
    return outcome(true);
  }

  // Rewrites accessibility text (ActualText, Alt) in a page's own stream, for pages whose visible
  // text wasn't edited but whose marked content repeats a changed phrase.
  function scrubPage(L, doc, page, scrub) {
    const source = pageContentString(L, doc, page);
    if (!source) return false;
    const replacements = scrubMarkedContent(parseOps(source), scrub);
    if (!replacements.length) return false;
    setPageContent(L, doc, page, splice(source, replacements));
    return true;
  }

  // The glyphs a page draws, in drawing order: { letter, x, end, y, fontKey } in page space.
  function pageGlyphs(L, doc, page) {
    const source = pageContentString(L, doc, page);
    if (!source) return [];
    const ops = parseOps(source);
    const context = resourceContext(L, doc, page.node.Resources() || doc.context.obj({}), { fonts: new Map(), forms: new Map() });
    const { glyphs } = layoutGlyphs(ops, context.fontFor, { xobjectFor: context.xobjectFor, level: { depth: 0, ops, source } });
    return glyphs.map((glyph) => ({ letter: glyphLetter(glyph), x: glyph.x, end: glyph.end, y: glyph.y, fontKey: glyph.state.fontKey }));
  }

  globalThis.PdfText = { lex, parseOps, parseToUnicode, layoutGlyphs, pageGlyphs, editPage, scrubPage, decodePdfText, winAnsiChar };
})();
