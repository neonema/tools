// Free fonts for letters a PDF's own fonts don't have. The library lives at /fonts/ on this site:
// index.json lists every family, each family has meta.<hash>.json (styles, widths, files) and small
// TrueType files cut by Unicode range. Only the files an edit needs are downloaded; nothing about the
// PDF leaves the browser except which font files are fetched.
//
// A PDF font is matched by, in order: the same family by name ("OpenSans-SemiBold" -> Open Sans 600);
// a free font with the same widths ("Calibri" -> Carlito, from the index's alias table); the closest
// family by class, proportions, and the widths of the letters the PDF font has. Exposes
// globalThis.FontLibrary.

(() => {
  // ---- Names --------------------------------------------------------------------------------

  // Checked in this order, so "semibold" is not read as "bold" and "extralight" not as "light".
  const WEIGHT_WORDS = [
    [/(extra|ultra)light/, 200],
    [/(extra|ultra)bold/, 800],
    [/(semi|demi)bold|^demi$|demi$/, 600],
    [/hairline|thin/, 100],
    [/light/, 300],
    [/medium/, 500],
    [/black|heavy/, 900],
    [/bold|^bd|^b$|^bi$/, 700],
  ];
  const TRAILING = /(psmt|mt|ps|std|pro|lt|com|ot|regular|roman|book|normal|bold|italic|oblique|light|medium|semibold|demibold|black|heavy|thin|it)$/;

  function normalise(text) {
    return String(text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function weightOf(text) {
    for (const [pattern, value] of WEIGHT_WORDS) if (pattern.test(text)) return value;
    return null;
  }

  // "ABCDEF+TimesNewRomanPS-BoldItalicMT" -> { keys: ["timesnewromanps", "timesnewroman"], weight: 700, italic: true }
  function parseName(baseFont) {
    const name = String(baseFont || "").replace(/^[A-Z]{6}\+/, "");
    const split = name.match(/^([^,-]+)[,-]?(.*)$/) || [name, name, ""];
    const lowered = name.toLowerCase();
    const stylePart = normalise(split[2]).replace(/mt$/, "");
    // The style after "-" or ","; else a weight word ending the family part ("CalibriLight").
    const familyEnd = (normalise(split[1]).match(/(extralight|ultralight|extrabold|ultrabold|semibold|demibold|light|medium|bold|black|heavy|thin)$/) || [""])[0];
    const weight = weightOf(stylePart) ?? (familyEnd ? weightOf(familyEnd) : null);
    const italic = /italic|oblique|slanted|kursiv/.test(lowered) || /^(it|i|bi|boldit|bdit)$|it$/.test(stylePart);
    const keys = [];
    let key = normalise(split[1]);
    while (key && !keys.includes(key)) {
      keys.push(key);
      key = key.replace(TRAILING, "");
    }
    return { name, keys, weight, italic };
  }

  // ---- TrueType files -------------------------------------------------------------------------

  function parseTrueType(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tables = {};
    for (let i = 0; i < view.getUint16(4); i += 1) {
      const at = 12 + 16 * i;
      const tag = String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
      tables[tag] = view.getUint32(at + 8);
    }
    for (const tag of ["head", "hhea", "hmtx", "maxp", "cmap", "glyf"]) {
      if (tables[tag] === undefined) throw new Error(`font has no ${tag} table`);
    }
    const unitsPerEm = view.getUint16(tables.head + 18) || 1000;
    const scale = 1000 / unitsPerEm;
    const bbox = [36, 38, 40, 42].map((k) => Math.round(view.getInt16(tables.head + k) * scale));
    const glyphCount = view.getUint16(tables.maxp + 4);
    const metricsCount = view.getUint16(tables.hhea + 34);
    const advance = (gid) => Math.round(view.getUint16(tables.hmtx + 4 * Math.min(gid, metricsCount - 1)) * scale);
    const os2 = tables["OS/2"];
    const capHeight = os2 !== undefined && view.getUint16(os2) >= 2 ? Math.round(view.getInt16(os2 + 88) * scale) : bbox[3];
    const italicAngle = tables.post !== undefined ? view.getInt32(tables.post + 4) / 65536 : 0;

    // Unicode -> glyph id, from a (3,10)/(0,4) format 12 table or a (3,1)/(0,3) format 4 table.
    const cmap = new Map();
    const base = tables.cmap;
    const subtables = [];
    for (let i = 0; i < view.getUint16(base + 2); i += 1) {
      subtables.push({
        platform: view.getUint16(base + 4 + 8 * i),
        encoding: view.getUint16(base + 6 + 8 * i),
        offset: base + view.getUint32(base + 8 + 8 * i),
      });
    }
    const pick = (format) => subtables.find((t) => view.getUint16(t.offset) === format && (t.platform === 3 || t.platform === 0));
    const f12 = pick(12);
    const f4 = pick(4);
    if (f12) {
      const groups = view.getUint32(f12.offset + 12);
      for (let g = 0; g < groups; g += 1) {
        const at = f12.offset + 16 + 12 * g;
        const start = view.getUint32(at);
        const end = view.getUint32(at + 4);
        const first = view.getUint32(at + 8);
        for (let cp = start; cp <= end && cp - start < 65536; cp += 1) cmap.set(cp, first + (cp - start));
      }
    } else if (f4) {
      const segments = view.getUint16(f4.offset + 6) / 2;
      const ends = f4.offset + 14;
      const starts = ends + 2 * segments + 2;
      const deltas = starts + 2 * segments;
      const ranges = deltas + 2 * segments;
      for (let s = 0; s < segments; s += 1) {
        const end = view.getUint16(ends + 2 * s);
        const start = view.getUint16(starts + 2 * s);
        const delta = view.getInt16(deltas + 2 * s);
        const range = view.getUint16(ranges + 2 * s);
        for (let cp = start; cp <= end && cp !== 0xffff; cp += 1) {
          let gid;
          if (!range) gid = (cp + delta) & 0xffff;
          else {
            const glyph = view.getUint16(ranges + 2 * s + range + 2 * (cp - start));
            gid = glyph ? (glyph + delta) & 0xffff : 0;
          }
          if (gid) cmap.set(cp, gid);
        }
      }
    }

    // PostScript name (name ID 6), for the embedded font's BaseFont.
    let postScriptName = "";
    if (tables.name !== undefined) {
      const n = tables.name;
      const strings = n + view.getUint16(n + 4);
      for (let i = 0; i < view.getUint16(n + 2); i += 1) {
        const at = n + 6 + 12 * i;
        if (view.getUint16(at + 6) !== 6) continue;
        const platform = view.getUint16(at);
        const length = view.getUint16(at + 8);
        const offset = strings + view.getUint16(at + 10);
        let text = "";
        if (platform === 3 || platform === 0) for (let k = 0; k + 1 < length; k += 2) text += String.fromCharCode(view.getUint16(offset + k));
        else for (let k = 0; k < length; k += 1) text += String.fromCharCode(bytes[offset + k]);
        postScriptName = text.replace(/[^A-Za-z0-9-]/g, "");
        if (postScriptName) break;
      }
    }
    return {
      bytes,
      unitsPerEm,
      bbox,
      glyphCount,
      advance,
      cmap,
      capHeight,
      ascent: Math.round(view.getInt16(tables.hhea + 4) * scale),
      descent: Math.round(view.getInt16(tables.hhea + 6) * scale),
      italicAngle,
      postScriptName: postScriptName || "LibraryFont",
    };
  }

  // ---- Embedding ------------------------------------------------------------------------------
  // A library file is embedded whole (they are small) as a Type0 font with Identity-H encoding, so
  // text is written as two-byte glyph ids. ToUnicode keeps the new letters searchable and copyable.

  function tagFor(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
    let tag = "";
    for (let i = 0; i < 6; i += 1) {
      tag += String.fromCharCode(65 + (hash % 26));
      hash = Math.floor(hash / 26) + i * 7919;
    }
    return tag;
  }

  function toUnicodeCMap(file) {
    const byGlyph = new Map();
    for (const [cp, gid] of file.cmap) if (!byGlyph.has(gid)) byGlyph.set(gid, cp);
    const hex = (n, size) => n.toString(16).toUpperCase().padStart(size, "0");
    const utf16 = (cp) => {
      if (cp < 0x10000) return hex(cp, 4);
      const v = cp - 0x10000;
      return hex(0xd800 + (v >> 10), 4) + hex(0xdc00 + (v & 0x3ff), 4);
    };
    const entries = [...byGlyph].sort((a, b) => a[0] - b[0]).map(([gid, cp]) => `<${hex(gid, 4)}> <${utf16(cp)}>`);
    const blocks = [];
    for (let i = 0; i < entries.length; i += 100) {
      const chunk = entries.slice(i, i + 100);
      blocks.push(`${chunk.length} beginbfchar\n${chunk.join("\n")}\nendbfchar`);
    }
    return [
      "/CIDInit /ProcSet findresource begin",
      "12 dict begin",
      "begincmap",
      "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
      "/CMapName /Adobe-Identity-UCS def",
      "/CMapType 2 def",
      "1 begincodespacerange",
      "<0000> <FFFF>",
      "endcodespacerange",
      ...blocks,
      "endcmap",
      "CMapName currentdict /CMap defineresource pop",
      "end",
      "end",
    ].join("\n");
  }

  const embedded = new WeakMap();

  function embed(L, doc, file) {
    if (!embedded.has(doc)) embedded.set(doc, new Map());
    const cache = embedded.get(doc);
    if (cache.has(file.url)) return cache.get(file.url);
    const ctx = doc.context;
    const baseFont = `${tagFor(file.url)}+${file.postScriptName}`;
    const fontFile = ctx.register(ctx.flateStream(file.bytes, { Length1: file.bytes.length }));
    const descriptor = ctx.register(
      ctx.obj({
        Type: "FontDescriptor",
        FontName: baseFont,
        Flags: 4 | (file.italicAngle ? 64 : 0),
        FontBBox: file.bbox,
        ItalicAngle: file.italicAngle,
        Ascent: file.ascent,
        Descent: file.descent,
        CapHeight: file.capHeight,
        StemV: 80,
        FontFile2: fontFile,
      }),
    );
    const widths = [];
    for (let gid = 0; gid < file.glyphCount; gid += 1) widths.push(file.advance(gid));
    const cidFont = ctx.register(
      ctx.obj({
        Type: "Font",
        Subtype: "CIDFontType2",
        BaseFont: baseFont,
        CIDSystemInfo: { Registry: L.PDFString.of("Adobe"), Ordering: L.PDFString.of("Identity"), Supplement: 0 },
        FontDescriptor: descriptor,
        DW: 1000,
        W: [0, widths],
        CIDToGIDMap: "Identity",
      }),
    );
    const toUnicode = ctx.register(ctx.flateStream(new TextEncoder().encode(toUnicodeCMap(file))));
    const ref = ctx.register(
      ctx.obj({ Type: "Font", Subtype: "Type0", BaseFont: baseFont, Encoding: "Identity-H", DescendantFonts: [cidFont], ToUnicode: toUnicode }),
    );
    cache.set(file.url, ref);
    return ref;
  }

  // ---- Choosing a family and style --------------------------------------------------------------

  function styleKey(weight, italic) {
    return `${weight}${italic ? "i" : ""}`;
  }

  // The style closest to the wanted weight, preferring the same slant.
  function pickStyle(styles, weight, italic) {
    let best = null;
    for (const key of Object.keys(styles)) {
      const style = styles[key];
      const cost = Math.abs(style.weight - weight) + (style.italic === italic ? 0 : 1000);
      if (!best || cost < best.cost) best = { key, cost };
    }
    return best ? best.key : null;
  }

  // PDF FontDescriptor Flags: 1 FixedPitch, 2 Serif, 8 Script, 64 Italic, 1<<18 ForceBold.
  function classOf(info, parsed) {
    const name = parsed.name.toLowerCase();
    if (info.flags & 1 || /mono|courier|consol|typewriter|code/.test(name)) return "mono";
    if (info.flags & 8 || /script|hand|brush/.test(name)) return "handwriting";
    if (/sans|gothic|grotesk|helvet|arial|verdana|tahoma/.test(name)) return "sans";
    if (info.flags & 2 || /serif|roman|times|garamond|georgia|book|antiqua/.test(name)) return "serif";
    return "sans";
  }

  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[(sorted.length - 1) >> 1];
  }

  // How far a font's widths (ASCII 32-126, 1000-unit space) are from the PDF font's, over the
  // letters the PDF font has. The PDF font may be bolder or narrower than the regular style it is
  // compared with, so the widths are first scaled by their median ratio: what counts is the pattern
  // (which letters are wide, which narrow), plus a smaller cost for the scale itself. Null with fewer
  // than 3 letters to compare.
  function widthDistance(widths, table) {
    const pairs = [];
    for (const [ch, width] of Object.entries(widths || {})) {
      const cp = ch.codePointAt(0);
      if (cp <= 32 || cp > 126 || !(width > 0)) continue;
      const theirs = table ? table[cp - 32] : 0;
      if (theirs > 0) pairs.push([width, theirs]);
    }
    if (pairs.length < 3) return null;
    const ratio = median(pairs.map(([mine, theirs]) => mine / theirs));
    return median(pairs.map(([mine, theirs]) => Math.abs(mine - ratio * theirs) / mine)) + 0.5 * Math.abs(Math.log(ratio));
  }

  function createLibrary({ baseUrl, fetch: fetchImpl }) {
    const base = String(baseUrl).endsWith("/") ? String(baseUrl) : `${baseUrl}/`;
    const json = new Map();
    const files = new Map();
    const choices = new Map();

    // A file that isn't there comes back 403 or 404: both mean "not in the library".
    async function getBytes(url) {
      try {
        const response = await fetchImpl(url);
        if (!response || !response.ok) return null;
        return new Uint8Array(await response.arrayBuffer());
      } catch {
        return null;
      }
    }
    function getJson(path) {
      if (!json.has(path)) {
        json.set(
          path,
          getBytes(base + path).then((bytes) => {
            if (!bytes) return null;
            try {
              return JSON.parse(new TextDecoder().decode(bytes));
            } catch {
              return null;
            }
          }),
        );
      }
      return json.get(path);
    }
    const index = () => getJson("index.json");
    async function familyMeta(family) {
      return family ? getJson(family.meta) : null;
    }
    function getFile(familyId, entry) {
      const url = `${base}${familyId}/${entry.file}`;
      if (!files.has(url)) {
        files.set(
          url,
          getBytes(url).then((bytes) => {
            if (!bytes) return null;
            try {
              return { ...parseTrueType(bytes), url, ranges: entry.ranges };
            } catch {
              return null;
            }
          }),
        );
      }
      return files.get(url);
    }

    function aliasTargets(idx, keys) {
      const out = [];
      for (const key of keys) for (const target of idx.aliases.exact[key] || []) out.push(target);
      const prefixes = Object.keys(idx.aliases.prefix).sort((a, b) => b.length - a.length);
      for (const key of keys) {
        const prefix = prefixes.find((p) => key.startsWith(p));
        if (prefix) for (const target of idx.aliases.prefix[prefix]) out.push(target);
      }
      return out;
    }

    // { family, meta, style, kind: "same" | "alias" | "closest" } or null.
    async function choose(info) {
      if (choices.has(info.key)) return choices.get(info.key);
      const promise = (async () => {
        const idx = await index();
        if (!idx || !Array.isArray(idx.families)) return null;
        const parsed = parseName(info.typeface || info.baseFont);
        let weight = parsed.weight || (info.flags & (1 << 18) ? 700 : 400);
        const italic = parsed.italic || Boolean(info.flags & 64) || Math.abs(info.italicAngle || 0) > 1;
        const byId = new Map(idx.families.map((f) => [f.id, f]));
        const settle = async (family, kind, forcedStyle) => {
          const meta = await familyMeta(family);
          if (!meta || !meta.styles) return null;
          let wantWeight = weight;
          let wantItalic = italic;
          if (forcedStyle) {
            wantWeight = parsed.weight || Number(forcedStyle.replace("i", ""));
            wantItalic = italic || forcedStyle.endsWith("i");
          }
          const style = pickStyle(meta.styles, wantWeight, wantItalic);
          return style ? { family, meta, style, kind } : null;
        };

        // 1. The same family, by name.
        for (const key of parsed.keys) {
          const family = idx.families.find((f) => f.key === key);
          if (family) {
            const found = await settle(family, "same");
            if (found) return found;
          }
        }
        // 2. A free font with the same widths, from the alias table.
        for (const target of aliasTargets(idx, parsed.keys)) {
          const [id, forced] = target.split(":");
          const family = byId.get(id);
          if (!family) continue;
          const found = await settle(family, "alias", forced);
          if (found) return found;
        }
        // 3. The closest family of the same class, by the widths of the letters the PDF font has,
        //    compared with every family's regular widths from one table (widths.<hash>.json), with
        //    cap height and x-height as a smaller term where the PDF states them. The best three are
        //    then compared again in the style that would be used, and only they fetch metadata.
        const wanted = classOf(info, parsed);
        const table = idx.widths ? await getJson(idx.widths) : null;
        const shape = (f) => {
          const [capHeight, xHeight] = f.m;
          let score = 0;
          if (info.capHeight > 0 && capHeight > 0) score += Math.abs(info.capHeight - capHeight) / capHeight;
          if (info.xHeight > 0 && xHeight > 0) score += Math.abs(info.xHeight - xHeight) / xHeight;
          return score;
        };
        const ranked = idx.families
          .filter((f) => f.category === wanted && f.slices.includes("latin"))
          .map((f) => {
            const distance = table && table.families ? widthDistance(info.widths, table.families[f.id]) : null;
            return { family: f, distance, score: (distance === null ? 1 : distance * 2) + shape(f) * 0.25 };
          })
          .sort((a, b) => a.score - b.score)
          .slice(0, 3);
        let best = null;
        for (const { family, score } of ranked) {
          const found = await settle(family, "closest");
          if (!found) continue;
          const style = found.meta.styles[found.style];
          const distance = widthDistance(info.widths, style.metrics && style.metrics.widths);
          const total = distance === null ? score : distance * 2 + shape(family) * 0.25;
          if (!best || total < best.total) best = { ...found, total };
        }
        return best;
      })().catch(() => null);
      choices.set(info.key, promise);
      return promise;
    }

    // wants: Map key -> { info, chars: Set }. Downloads what those letters need and returns a
    // resolver the (synchronous) page rewriter can ask for glyphs.
    async function prepare(wants) {
      const resolved = new Map();
      await Promise.all(
        [...wants.values()].map(async ({ info, chars }) => {
          const choice = await choose(info);
          if (!choice) return;
          const style = choice.meta.styles[choice.style];
          const needed = new Set();
          const latin = style.files.find((f) => f.slice === "latin");
          if (latin) needed.add(latin); // for width ratios
          for (const ch of chars) {
            const cp = ch.codePointAt(0);
            const entry = style.files.find((f) => f.ranges.some(([a, b]) => cp >= a && cp <= b));
            if (entry) needed.add(entry);
          }
          const loaded = (await Promise.all([...needed].map((entry) => getFile(choice.family.id, entry)))).filter(Boolean);
          resolved.set(info.key, { choice, files: loaded });
        }),
      );
      return resolverFor(resolved);
    }

    return { index, choose, prepare };
  }

  function resolverFor(resolved) {
    const glyphIn = (entry, ch) => {
      const cp = ch.codePointAt(0);
      for (const file of entry.files) {
        const gid = file.cmap.get(cp);
        if (gid) return { file, gid, width: file.advance(gid) };
      }
      return null;
    };
    return {
      size: resolved.size,
      glyph(info, ch) {
        const entry = resolved.get(info.key);
        if (!entry) return null;
        const found = glyphIn(entry, ch);
        return found ? { ...found, kind: entry.choice.kind, family: entry.choice.family.name } : null;
      },
      widthOf(info, ch) {
        const entry = resolved.get(info.key);
        const found = entry ? glyphIn(entry, ch) : null;
        return found ? found.width : 0;
      },
      choiceFor(info) {
        const entry = resolved.get(info.key);
        return entry ? { family: entry.choice.family.name, style: entry.choice.style, kind: entry.choice.kind } : null;
      },
      embed,
    };
  }

  // The dry run's stand-in: records every letter asked for, by font, and answers with a
  // placeholder so the run carries on and asks for the rest.
  function collector() {
    const wants = new Map();
    return {
      collecting: true,
      wants,
      get size() {
        return wants.size;
      },
      glyph(info, ch) {
        if (!wants.has(info.key)) wants.set(info.key, { info: { ...info, widths: { ...info.widths } }, chars: new Set() });
        const want = wants.get(info.key);
        want.chars.add(ch);
        Object.assign(want.info.widths, info.widths);
        return { file: null, gid: 0, width: 500, kind: "pending", family: "" };
      },
      widthOf() {
        return 0;
      },
      choiceFor() {
        return null;
      },
      embed() {
        return null;
      },
    };
  }

  // The page's own library, at /fonts/ on this site. Off where there is no fetch (tests opt in
  // with configure).
  let shared = null;
  function configure(options) {
    shared = options ? createLibrary(options) : null;
    return shared;
  }
  function current() {
    if (shared === null && typeof globalThis.fetch === "function" && globalThis.location) {
      shared = createLibrary({ baseUrl: new URL("/fonts/", globalThis.location.href).href, fetch: (url) => globalThis.fetch(url) });
    }
    return shared;
  }

  globalThis.FontLibrary = { parseName, parseTrueType, createLibrary, configure, current, collector, embed, pickStyle };
})();
