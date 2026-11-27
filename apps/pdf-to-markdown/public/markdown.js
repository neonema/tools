// Turns positioned text runs into Markdown. Runs use the same horizontal-text rule as the
// PDF editor: upright, unrotated, large enough to read. The editor rewrites those runs back
// into the PDF; this tool groups them into lines, columns, headings, and lists.
(function () {
  const MAX_PDF_BYTES = 80 * 1024 * 1024;
  const MAX_PAGES = 400;

  function checkFileSize(size) {
    if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "This file is empty." };
    if (size > MAX_PDF_BYTES) return { ok: false, error: "PDF files have to be 80 MB or smaller." };
    return { ok: true };
  }

  function hasPdfHeader(bytes) {
    if (!bytes || bytes.length < 5) return false;
    const length = Math.min(bytes.length, 1024);
    let text = "";
    for (let index = 0; index < length; index += 1) text += String.fromCharCode(bytes[index]);
    return text.includes("%PDF-");
  }

  function downloadName(filename) {
    const base = String(filename || "")
      .split(/[/\\]/)
      .pop()
      .replace(/^\.+/, "")
      .trim()
      .replace(/[\u0000-\u001f]/g, "");
    const stem = base.replace(/\.pdf$/i, "").trim();
    return `${stem || "document"}.md`;
  }

  function inspectItem(item, style, face) {
    if (!item || typeof item.str !== "string" || !item.str.trim()) return null;
    const [a, b, c, d, e, f] = item.transform || [];
    if (![a, b, c, d, e, f].every(Number.isFinite)) return null;
    if (Math.abs(b) > 0.01 * Math.abs(a) || Math.abs(c) > 0.01 * Math.abs(d) || a <= 0 || d <= 0) {
      return { skipped: "rotated" };
    }
    const fontSize = Math.hypot(c, d);
    const width = Number(item.width);
    if (fontSize < 2 || !(width > 0)) return null;
    const name = `${(face && face.name) || ""} ${item.fontName || ""}`;
    const family = style && style.fontFamily;
    return {
      run: {
        text: item.str,
        x: e,
        y: f,
        width,
        fontSize,
        bold: Boolean(face && face.bold) || /bold|black|heavy|semibold|demi/i.test(name),
        italic: Boolean(face && face.italic) || /italic|oblique/i.test(name),
        mono: family === "monospace" || Boolean(face && face.mono) || /mono|courier|consolas|menlo/i.test(name),
      },
    };
  }

  const LIGATURES = { ﬁ: "fi", ﬂ: "fl", ﬀ: "ff", ﬃ: "ffi", ﬄ: "ffl" };

  function clean(text) {
    return String(text)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
      .replace(/\u00ad/g, "")
      .replace(/[ﬁﬂﬀﬃﬄ]/g, (ch) => LIGATURES[ch])
      .replace(/[^\S\n]+/g, " ");
  }

  function plain(spans) {
    return spans.map((span) => span.text).join("");
  }

  function mergeSpans(spans) {
    const out = [];
    for (const span of spans) {
      if (!span || !span.text) continue;
      const prev = out[out.length - 1];
      const bold = Boolean(span.bold);
      const italic = Boolean(span.italic);
      const mono = Boolean(span.mono);
      if (prev && prev.bold === bold && prev.italic === italic && prev.mono === mono) prev.text += span.text;
      else out.push({ text: span.text, bold, italic, mono });
    }
    return out;
  }

  function dedupeRuns(runs) {
    const kept = [];
    for (const run of runs) {
      const twin = kept.some(
        (prev) => prev.text === run.text && Math.abs(prev.x - run.x) < 0.8 && Math.abs(prev.y - run.y) < 0.8,
      );
      if (!twin) kept.push(run);
    }
    return kept;
  }

  function dominantSize(runs) {
    let best = runs[0].fontSize;
    let most = -1;
    const counts = new Map();
    for (const run of runs) {
      const key = Math.round(run.fontSize * 2) / 2;
      const count = (counts.get(key) || 0) + Math.max(1, run.text.trim().length);
      counts.set(key, count);
      if (count > most) {
        most = count;
        best = key;
      }
    }
    return best;
  }

  function joinRuns(runs) {
    const spans = [];
    let prev = null;
    for (const run of runs) {
      const text = clean(run.text);
      if (!text) continue;
      if (prev) {
        const gap = run.x - (prev.x + prev.width);
        const size = Math.min(prev.fontSize, run.fontSize) || run.fontSize;
        const hasSpace = /\s$/.test(plain(spans)) || /^\s/.test(text);
        if (!hasSpace && gap > size * 0.17) {
          const same = prev.bold === run.bold && prev.italic === run.italic && prev.mono === run.mono;
          spans.push({ text: " ", bold: same && run.bold, italic: same && run.italic, mono: same && run.mono });
        }
      }
      spans.push({
        text,
        bold: Boolean(run.bold),
        italic: Boolean(run.italic),
        mono: Boolean(run.mono),
      });
      prev = run;
    }
    return mergeSpans(spans);
  }

  function groupLines(runs) {
    const sorted = [...runs].sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    for (const run of sorted) {
      const line = lines[lines.length - 1];
      const size = line ? Math.min(line.fontSize, run.fontSize) : 0;
      if (line && Math.abs(line.y - run.y) <= size * 0.5) line.runs.push(run);
      else lines.push({ y: run.y, fontSize: run.fontSize, runs: [run] });
    }
    return lines;
  }

  function segmentFrom(runs, pageHeight) {
    const spans = joinRuns(runs);
    const text = plain(spans);
    if (!text.trim()) return null;
    const x = Math.min(...runs.map((run) => run.x));
    const end = Math.max(...runs.map((run) => run.x + run.width));
    const y = Math.max(...runs.map((run) => run.y));
    const letters = text.replace(/\s/g, "");
    const weight = (flag) =>
      spans.reduce((sum, span) => sum + (span[flag] ? span.text.replace(/\s/g, "").length : 0), 0);
    const count = letters.length || 1;
    return {
      x,
      y,
      width: Math.max(0, end - x),
      fontSize: dominantSize(runs),
      spans,
      text,
      bold: weight("bold") / count >= 0.6,
      italic: weight("italic") / count >= 0.6,
      mono: weight("mono") / count >= 0.8,
      inMargin: pageHeight > 0 && (pageHeight - y < pageHeight * 0.07 || y < pageHeight * 0.07),
      url: "",
    };
  }

  function segmentsOf(runs, pageHeight) {
    const segments = [];
    for (const line of groupLines(runs)) {
      const ordered = [...line.runs].sort((a, b) => a.x - b.x);
      let current = [];
      const flush = () => {
        if (!current.length) return;
        const segment = segmentFrom(current, pageHeight);
        if (segment) segments.push(segment);
        current = [];
      };
      for (const run of ordered) {
        const prev = current[current.length - 1];
        if (prev) {
          const gap = run.x - (prev.x + prev.width);
          const size = Math.min(prev.fontSize, run.fontSize) || run.fontSize;
          if (gap > Math.max(size * 1.5, 14)) flush();
        }
        current.push(run);
      }
      flush();
    }
    return segments;
  }

  function safeUrl(url) {
    const value = String(url || "").trim();
    if (!/^https?:\/\//i.test(value) && !/^mailto:/i.test(value)) return "";
    if (/[\s<>]/.test(value)) return "";
    return value.replace(/\)/g, "%29");
  }

  function attachLinks(segments, links) {
    for (const segment of segments) {
      let best = "";
      let bestOverlap = 0;
      for (const link of links || []) {
        const url = safeUrl(link.url);
        if (!url) continue;
        const top = link.y + link.height;
        if (segment.y < link.y - 2 || segment.y > top + segment.fontSize * 0.3) continue;
        const overlap = Math.min(segment.x + segment.width, link.x + link.width) - Math.max(segment.x, link.x);
        if (overlap > bestOverlap && overlap > Math.min(segment.width, link.width) * 0.35) {
          bestOverlap = overlap;
          best = url;
        }
      }
      segment.url = best;
    }
  }

  function marginKey(segment) {
    const key = segment.text.trim().replace(/\s+/g, " ").toLowerCase();
    if (key.length < 2 || key.length > 180) return "";
    return key;
  }

  function repeatedMargins(pages) {
    const counts = new Map();
    for (const page of pages) {
      const seen = new Set();
      for (const segment of page.segments) {
        if (!segment.inMargin) continue;
        const key = marginKey(segment);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    const drop = new Set();
    for (const [key, count] of counts) if (count >= 2) drop.add(key);
    return drop;
  }

  function isPageNumber(text) {
    return /^(?:page\s+)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?$/i.test(text.trim());
  }

  function sortReading(segments) {
    return [...segments].sort((a, b) => b.y - a.y || a.x - b.x);
  }

  function columnGutter(segments, left, right) {
    if (segments.length < 4) return null;
    const bins = 48;
    const width = Math.max(right - left, 1);
    const counts = new Array(bins).fill(0);
    for (const segment of segments) {
      const start = Math.max(0, Math.min(bins - 1, Math.floor(((segment.x - left) / width) * bins)));
      const end = Math.max(0, Math.min(bins - 1, Math.floor(((segment.x + segment.width - left) / width) * bins)));
      for (let index = start; index <= end; index += 1) counts[index] += 1;
    }
    const from = Math.floor(bins * 0.28);
    const to = Math.ceil(bins * 0.72);
    let best = -1;
    let bestCount = Infinity;
    for (let index = from; index <= to; index += 1) {
      if (counts[index] < bestCount) {
        bestCount = counts[index];
        best = index;
      }
    }
    if (best < 0) return null;
    const leftPeak = Math.max(0, ...counts.slice(0, best));
    const rightPeak = Math.max(0, ...counts.slice(best + 1));
    // A real gutter is much emptier than the text on both sides. One line that crosses it,
    // such as a full-width sentence, does not fill it the way a single column does.
    if (leftPeak < 2 || rightPeak < 2 || bestCount * 2 >= Math.min(leftPeak, rightPeak)) return null;
    const gutter = left + ((best + 0.5) / bins) * width;
    const leftCount = segments.filter((segment) => segment.x + segment.width / 2 < gutter).length;
    if (leftCount < 2 || segments.length - leftCount < 2) return null;
    return gutter;
  }

  function readingOrder(segments) {
    if (segments.length < 4) return sortReading(segments);
    const left = Math.min(...segments.map((segment) => segment.x));
    const right = Math.max(...segments.map((segment) => segment.x + segment.width));
    const contentWidth = Math.max(right - left, 1);
    const wide = segments.filter((segment) => segment.width >= contentWidth * 0.62);
    const narrow = segments.filter((segment) => segment.width < contentWidth * 0.62);
    const gutter = columnGutter(narrow, left, right);
    if (gutter == null) return sortReading(segments);
    const out = [];
    let ceiling = Infinity;
    const emitBand = (floor) => {
      const band = narrow.filter((segment) => segment.y < ceiling && segment.y > floor);
      out.push(
        ...sortReading(band.filter((segment) => segment.x + segment.width / 2 < gutter)),
        ...sortReading(band.filter((segment) => segment.x + segment.width / 2 >= gutter)),
      );
    };
    for (const barrier of sortReading(wide)) {
      emitBand(barrier.y);
      out.push(barrier);
      ceiling = barrier.y;
    }
    emitBand(-Infinity);
    return out;
  }

  function continues(prev, next) {
    const size = Math.min(prev.fontSize, next.fontSize) || 12;
    if (Math.abs(prev.y - next.y) <= size * 0.5 && next.x + 1 >= prev.x - 1) return true;
    if (prev.mono !== next.mono) return false;
    if (Math.abs(prev.fontSize - next.fontSize) > Math.max(prev.fontSize, next.fontSize) * 0.18) return false;
    const dy = prev.y - next.y;
    if (dy <= size * 0.35) return false;
    if (dy > Math.max(prev.fontSize, next.fontSize) * 1.9) return false;
    if (Math.abs(next.x - prev.x) > 56) return false;
    return true;
  }

  function dropChars(spans, count) {
    const out = [];
    let left = count;
    for (const span of spans) {
      if (left <= 0) {
        out.push({ ...span });
        continue;
      }
      if (span.text.length <= left) {
        left -= span.text.length;
        continue;
      }
      out.push({ ...span, text: span.text.slice(left) });
      left = 0;
    }
    return out;
  }

  function listMarker(segment) {
    const match =
      segment.text.match(/^([•·●◦▪‣])\s+/) ||
      segment.text.match(/^([-–—])\s+(?=\S)/) ||
      segment.text.match(/^(\d{1,3}[.)])\s+(?=\S)/) ||
      segment.text.match(/^([a-zA-Z][.)])\s+(?=\S)/);
    if (!match) return null;
    const spans = dropChars(segment.spans, match[0].length);
    if (!plain(spans).trim()) return null;
    let marker = match[1];
    if (/^[•·●◦▪‣\-–—]$/.test(marker)) marker = "-";
    else {
      marker = marker.replace(/\)$/, ".");
      if (!marker.endsWith(".")) marker += ".";
    }
    return { marker, spans };
  }

  function headingLevel(segment, body, bodyKnown) {
    const text = segment.text.trim();
    if (text.length < 2 || text.length > 90) return 0;
    if (/[.!?]$/.test(text) && text.length > 48) return 0;
    const ratio = segment.fontSize / (body || 12);
    if (ratio >= 1.8) return 1;
    if (ratio >= 1.45) return 2;
    if (ratio >= 1.18) return 3;
    if (!bodyKnown && segment.fontSize >= 18 && text.length <= 70) return segment.fontSize >= 22 ? 1 : 2;
    return 0;
  }

  function documentBody(pages) {
    const longs = [];
    const all = [];
    for (const page of pages) {
      for (const segment of page.segments) {
        all.push(segment.fontSize);
        if (segment.text.trim().length >= 40) longs.push(segment.fontSize);
      }
    }
    const sample = longs.length ? longs : all;
    if (!sample.length) return { size: 12, known: false };
    sample.sort((a, b) => a - b);
    return { size: sample[sample.length >> 1], known: longs.length > 0 };
  }

  function blocksFrom(segments, body, bodyKnown) {
    const blocks = [];
    let para = [];
    const flush = () => {
      if (!para.length) return;
      blocks.push({ type: para.every((segment) => segment.mono) ? "code" : "paragraph", segs: para });
      para = [];
    };
    for (const segment of segments) {
      const marker = listMarker(segment);
      if (marker) {
        flush();
        const item = { marker: marker.marker, segs: [{ ...segment, spans: marker.spans, text: plain(marker.spans) }] };
        const last = blocks[blocks.length - 1];
        if (last && last.type === "list") last.items.push(item);
        else blocks.push({ type: "list", items: [item] });
        continue;
      }
      const level = headingLevel(segment, body, bodyKnown);
      if (level) {
        flush();
        blocks.push({ type: "heading", level, segs: [segment] });
        continue;
      }
      const prev = para[para.length - 1];
      if (prev && !continues(prev, segment)) flush();
      if (!para.length) {
        const last = blocks[blocks.length - 1];
        if (last && last.type === "list") {
          const item = last.items[last.items.length - 1];
          const first = item.segs[0];
          const gap = first.y - segment.y;
          if (segment.x > first.x + 8 && gap > 0 && gap < first.fontSize * 1.9) {
            item.segs.push(segment);
            continue;
          }
        }
      }
      para.push(segment);
    }
    flush();
    return blocks;
  }

  function glue(prev, next) {
    const size = Math.min(prev.fontSize, next.fontSize) || 12;
    if (Math.abs(prev.y - next.y) <= size * 0.5) return "  ";
    return " ";
  }

  function trimTrailingHyphen(spans) {
    for (let index = spans.length - 1; index >= 0; index -= 1) {
      if (!spans[index].text) continue;
      spans[index].text = spans[index].text.replace(/[-\u2010]$/, "");
      return;
    }
  }

  function joinParagraph(segs) {
    const spans = [];
    segs.forEach((segment, index) => {
      if (index > 0) {
        const prevPlain = plain(spans).trimEnd();
        const nextPlain = plain(segment.spans).trimStart();
        if (/[A-Za-z]-$/.test(prevPlain) && /^[a-z]/.test(nextPlain)) trimTrailingHyphen(spans);
        else spans.push({ text: glue(segs[index - 1], segment), bold: false, italic: false, mono: false });
      }
      spans.push(...segment.spans.map((span) => ({ ...span })));
    });
    return mergeSpans(spans);
  }

  function escapeMd(text) {
    return text.replace(/\\/g, "\\\\").replace(/([*_`\[\]])/g, "\\$1");
  }

  function wrapPad(text, open, close) {
    const lead = (text.match(/^\s*/) || [""])[0];
    const trail = (text.match(/\s*$/) || [""])[0];
    const core = text.trim();
    if (!core) return text;
    if (lead.length + trail.length >= text.length) return text;
    return `${lead}${open}${core}${close}${trail}`;
  }

  function renderSpans(spans) {
    return mergeSpans(spans)
      .map((span) => {
        if (span.mono) {
          const core = span.text.replace(/`/g, "").trim();
          if (!core) return span.text;
          return wrapPad(span.text.replace(/`/g, ""), "`", "`");
        }
        const escaped = escapeMd(span.text);
        if (span.bold && span.italic) return wrapPad(escaped, "***", "***");
        if (span.bold) return wrapPad(escaped, "**", "**");
        if (span.italic) return wrapPad(escaped, "*", "*");
        return escaped;
      })
      .join("");
  }

  function linkWrap(label, url) {
    const href = safeUrl(url);
    if (!href || !String(label).trim()) return label;
    return `[${label}](${href})`;
  }

  function renderSegments(segs) {
    const urls = [...new Set(segs.map((segment) => segment.url).filter(Boolean))];
    if (urls.length === 1 && segs.every((segment) => segment.url === urls[0])) {
      return linkWrap(renderSpans(joinParagraph(segs)), urls[0]);
    }
    if (urls.length) {
      return segs
        .map((segment, index) => {
          const piece = segment.url ? linkWrap(renderSpans(segment.spans), segment.url) : renderSpans(segment.spans);
          return index === 0 ? piece : glue(segs[index - 1], segment) + piece;
        })
        .join("");
    }
    return renderSpans(joinParagraph(segs));
  }

  function fence(text) {
    let run = 0;
    let longest = 0;
    for (const ch of text) {
      run = ch === "`" ? run + 1 : 0;
      if (run > longest) longest = run;
    }
    const ticks = "`".repeat(Math.max(3, longest + 1));
    return `${ticks}\n${text.replace(/\n+$/g, "")}\n${ticks}`;
  }

  function codeText(segs) {
    return segs.map((segment) => segment.text.replace(/\s+$/g, "")).join("\n");
  }

  function render(blocks) {
    const parts = [];
    for (const block of blocks) {
      if (block.type === "heading") parts.push(`${"#".repeat(block.level)} ${renderSegments(block.segs)}`);
      else if (block.type === "list") {
        parts.push(block.items.map((item) => `${item.marker} ${renderSegments(item.segs)}`).join("\n"));
      } else if (block.type === "code") parts.push(fence(codeText(block.segs)));
      else parts.push(renderSegments(block.segs));
    }
    const markdown = parts.map((part) => part.trim()).filter(Boolean).join("\n\n");
    return markdown ? `${markdown}\n` : "";
  }

  function preparePage(page) {
    const height = Number(page && page.height) || 0;
    const runs = dedupeRuns(
      (page && page.runs ? page.runs : []).filter(
        (run) => run && clean(run.text || "").trim() && [run.x, run.y, run.width, run.fontSize].every(Number.isFinite),
      ),
    );
    const segments = segmentsOf(runs, height);
    attachLinks(segments, page && page.links);
    return { segments };
  }

  function keptSegments(page, drop) {
    return page.segments.filter((segment) => {
      if (!segment.inMargin) return true;
      if (isPageNumber(segment.text)) return false;
      const key = marginKey(segment);
      return !key || !drop.has(key);
    });
  }

  function visualLines(segments) {
    const sorted = [...segments].sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    for (const segment of sorted) {
      const line = lines[lines.length - 1];
      const size = line ? Math.min(...line.map((item) => item.fontSize || 12), segment.fontSize || 12) : 0;
      if (line && Math.abs(line[0].y - segment.y) <= size * 0.55) line.push(segment);
      else lines.push([segment]);
    }
    return lines;
  }

  function transcriptLine(segments) {
    const ordered = [...segments].sort((a, b) => a.x - b.x);
    let text = "";
    let cursor = ordered[0].x;
    for (const segment of ordered) {
      const gap = segment.x - cursor;
      const size = segment.fontSize || 12;
      const spaces = Math.max(text ? 1 : 0, Math.round(gap / (size * 0.45)));
      if (text) text += " ".repeat(Math.min(32, spaces));
      text += segment.text.replace(/\s+/g, " ").trim();
      cursor = segment.x + Math.max(segment.width, 0);
    }
    return text.trim();
  }

  function transcriptOf(segments, body) {
    const lines = [];
    for (const line of visualLines(segments)) {
      const size = Math.max(...line.map((segment) => segment.fontSize || 0));
      const text = transcriptLine(line);
      if (!text) continue;
      const tag = body.known && size >= body.size * 1.18 ? `[${Math.round(size)}pt] ` : "";
      lines.push(`${tag}${text}`);
    }
    return lines.join("\n");
  }

  function pagePieces(pages) {
    const prepared = (pages || []).map(preparePage);
    const drop = repeatedMargins(prepared);
    const body = documentBody(prepared);
    return prepared.map((page) => {
      const kept = keptSegments(page, drop);
      const markdown = render(blocksFrom(readingOrder(kept), body.size, body.known));
      const transcript = transcriptOf(kept, body);
      return { markdown, transcript };
    });
  }

  function toMarkdown(pages) {
    const markdown = pagePieces(pages)
      .map((piece) => piece.markdown.trim())
      .filter(Boolean)
      .join("\n\n");
    return markdown ? `${markdown}\n` : "";
  }

  function visualMarkdown(transcript) {
    const blocks = [];
    let table = [];
    const flush = () => {
      if (!table.length) return;
      const width = Math.max(...table.map((row) => row.length));
      const lines = table.map((row) => {
        const cells = row.concat(Array(Math.max(0, width - row.length)).fill(""));
        return `| ${cells.join(" | ")} |`;
      });
      const divider = `| ${Array(width).fill("---").join(" | ")} |`;
      blocks.push([lines[0], divider, ...lines.slice(1)].join("\n"));
      table = [];
    };
    for (const raw of String(transcript || "").replace(/\r\n?/g, "\n").split("\n")) {
      const tagged = /^\s*\[\d+pt\]\s*(.*)$/.exec(raw);
      const body = (tagged ? tagged[1] : raw).trim();
      if (!body) {
        flush();
        continue;
      }
      const cells = body
        .split(/ {8,}/)
        .map((cell) => escapeMd(cell.replace(/ {2,}/g, " ").trim()))
        .filter(Boolean);
      if (cells.length >= 2) table.push(cells);
      else {
        flush();
        const text = cells[0] || escapeMd(body);
        blocks.push(tagged ? `# ${text}` : text);
      }
    }
    flush();
    const markdown = blocks.join("\n\n").trim();
    return markdown ? `${markdown}\n` : "";
  }

  globalThis.PdfMarkdown = {
    MAX_PDF_BYTES,
    MAX_PAGES,
    checkFileSize,
    hasPdfHeader,
    downloadName,
    inspectItem,
    toMarkdown,
    pagePieces,
    visualMarkdown,
  };
})();
