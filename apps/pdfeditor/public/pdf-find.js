// Find and replace over a page's text runs (from PDF.js getTextContent). Pure functions, no DOM.
// Exposes globalThis.PdfFind.
(function () {
  const WORD = /[\p{L}\p{N}_]/u;

  // Joins a page's runs into searchable text. Runs on the same baseline form one line; a line
  // break is never matched across. A visible gap between two runs counts as a space. Every
  // character maps back to { run, offset } (null for the gaps and line breaks this adds).
  function buildIndex(runs, textOf) {
    let text = "";
    const map = [];
    let previous = null;
    for (const run of runs) {
      const current = textOf(run);
      if (!current) continue;
      if (previous) {
        const sameLine =
          Math.abs(run.baseline - previous.baseline) <= 0.5 * Math.min(run.fontSize, previous.fontSize) &&
          run.x >= previous.x - 1;
        if (!sameLine) {
          text += "\n";
          map.push(null);
        } else {
          const gap = run.x - (previous.x + previous.width);
          const before = textOf(previous);
          if (gap > 0.15 * run.fontSize && !/\s$/.test(before) && !/^\s/.test(current)) {
            text += " ";
            map.push(null);
          }
        }
      }
      for (let offset = 0; offset < current.length; offset += 1) {
        text += current[offset];
        map.push({ run, offset });
      }
      previous = run;
    }
    return { text, map };
  }

  function sameFormat(a, b) {
    return a.fontName === b.fontName && Math.abs(a.fontSize - b.fontSize) < 0.1 && a.bold === b.bold && a.italic === b.italic;
  }

  // Returns matches as { start, end, segments: [{ run, start, end }], mixedFormat }. A match whose
  // letters come from runs with different fonts or sizes is marked mixedFormat: it can be shown,
  // but replacing it would change how some of it looks.
  function findMatches(index, query, options) {
    const matches = [];
    if (!query) return matches;
    const matchCase = Boolean(options && options.matchCase);
    const wholeWord = Boolean(options && options.wholeWord);
    let hay = index.text;
    let needle = query;
    if (!matchCase) {
      const lowerHay = hay.toLowerCase();
      const lowerNeedle = needle.toLowerCase();
      // Lower-casing can change length for a few characters; then compare exactly.
      if (lowerHay.length === hay.length && lowerNeedle.length === needle.length) {
        hay = lowerHay;
        needle = lowerNeedle;
      }
    }
    let at = hay.indexOf(needle);
    while (at !== -1) {
      const end = at + needle.length;
      const crossesLine = hay.slice(at, end).includes("\n");
      const boundaryOk =
        !wholeWord || ((at === 0 || !WORD.test(index.text[at - 1])) && (end >= index.text.length || !WORD.test(index.text[end])));
      if (!crossesLine && boundaryOk) {
        const segments = [];
        for (let i = at; i < end; i += 1) {
          const entry = index.map[i];
          if (!entry) continue;
          const last = segments[segments.length - 1];
          if (last && last.run === entry.run && last.end === entry.offset) last.end += 1;
          else segments.push({ run: entry.run, start: entry.offset, end: entry.offset + 1 });
        }
        if (segments.length) {
          const mixedFormat = segments.some((segment) => !sameFormat(segment.run, segments[0].run));
          matches.push({ start: at, end, segments, mixedFormat });
        }
        at = hay.indexOf(needle, end);
      } else {
        at = hay.indexOf(needle, at + 1);
      }
    }
    return matches;
  }

  // New text for each run a match touches. The replacement goes into the first run, where the
  // match starts, in that run's own font; text after the match in the last run joins it, and the
  // runs in between are emptied. Returns [{ run, text }].
  function replacementTexts(match, replacement, textOf) {
    const first = match.segments[0];
    const last = match.segments[match.segments.length - 1];
    const firstText = textOf(first.run);
    if (match.segments.length === 1) {
      return [{ run: first.run, text: firstText.slice(0, first.start) + replacement + firstText.slice(first.end) }];
    }
    const out = [{ run: first.run, text: firstText.slice(0, first.start) + replacement + textOf(last.run).slice(last.end) }];
    for (const segment of match.segments.slice(1)) out.push({ run: segment.run, text: "" });
    return out;
  }

  globalThis.PdfFind = { buildIndex, findMatches, replacementTexts };
})();
