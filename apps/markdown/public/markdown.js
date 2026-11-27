// A small Markdown renderer for the preview page.
// HTML in the source is escaped, so pasted markup cannot run.
// Images are links, never <img>, so the page does not fetch them.
(function () {
  const MAX_CHARS = 400000;

  function esc(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isWord(ch) {
    return Boolean(ch) && /[\p{L}\p{N}]/u.test(ch);
  }

  function safeUrl(url) {
    const value = String(url || "").trim();
    if (!/^(https?:|mailto:)/i.test(value)) return "";
    if (/[\u0000-\u001f\u007f\s<>"\\]/.test(value)) return "";
    return value;
  }

  function link(url, label) {
    const safe = safeUrl(url);
    if (!safe) return label;
    return `<a href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  }

  function inline(src) {
    const s = String(src);
    let i = 0;
    let out = "";

    while (i < s.length) {
      const ch = s[i];

      if (ch === "\\" && i + 1 < s.length) {
        out += esc(s[i + 1]);
        i += 2;
        continue;
      }

      if (ch === "`") {
        let n = 1;
        while (s[i + n] === "`") n += 1;
        const end = s.indexOf("`".repeat(n), i + n);
        if (end !== -1) {
          out += `<code>${esc(s.slice(i + n, end))}</code>`;
          i = end + n;
          continue;
        }
      }

      if (s.startsWith("![", i)) {
        const endAlt = s.indexOf("]", i + 2);
        if (endAlt !== -1 && s[endAlt + 1] === "(") {
          const close = s.indexOf(")", endAlt + 2);
          if (close !== -1) {
            const alt = inline(s.slice(i + 2, endAlt));
            const raw = s.slice(endAlt + 2, close).trim();
            out += link(raw, alt || esc(raw));
            i = close + 1;
            continue;
          }
        }
      }

      if (ch === "[") {
        const endText = s.indexOf("]", i + 1);
        if (endText !== -1 && s[endText + 1] === "(") {
          const close = s.indexOf(")", endText + 2);
          if (close !== -1) {
            const label = inline(s.slice(i + 1, endText));
            out += link(s.slice(endText + 2, close), label);
            i = close + 1;
            continue;
          }
        }
      }

      if (s.startsWith("**", i) || s.startsWith("__", i)) {
        const marker = s.slice(i, i + 2);
        const end = s.indexOf(marker, i + 2);
        if (end > i + 2) {
          out += `<strong>${inline(s.slice(i + 2, end))}</strong>`;
          i = end + 2;
          continue;
        }
      }

      if (s.startsWith("~~", i)) {
        const end = s.indexOf("~~", i + 2);
        if (end > i + 2) {
          out += `<del>${inline(s.slice(i + 2, end))}</del>`;
          i = end + 2;
          continue;
        }
      }

      if ((ch === "*" || ch === "_") && s[i + 1] && s[i + 1] !== ch && s[i + 1] !== " ") {
        if (!(ch === "_" && isWord(s[i - 1]))) {
          const end = s.indexOf(ch, i + 1);
          if (end > i + 1 && s[end - 1] !== " " && !(ch === "_" && isWord(s[end + 1]))) {
            out += `<em>${inline(s.slice(i + 1, end))}</em>`;
            i = end + 1;
            continue;
          }
        }
      }

      out += esc(ch);
      i += 1;
    }

    return out;
  }

  function fenceAt(line) {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!match) return null;
    return { char: match[1][0], len: match[1].length, info: match[2].trim() };
  }

  function headingAt(line) {
    const match = /^ {0,3}(#{1,6})\s+(\S.*)$/.exec(line);
    if (!match) return null;
    return { level: match[1].length, text: match[2].replace(/\s+#+\s*$/, "") };
  }

  function isHr(line) {
    return /^ {0,3}([-*_])\1{2,}\s*$/.test(line);
  }

  function isQuote(line) {
    return /^ {0,3}>/.test(line);
  }

  function listAt(line) {
    const match = /^(\s*)([-*+]|\d+[.)])\s+(\S.*)$/.exec(line);
    if (!match) return null;
    return { indent: match[1].length, marker: match[2], text: match[3] };
  }

  function isTableStart(lines, index) {
    if (index + 1 >= lines.length || !lines[index].includes("|")) return false;
    return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1]);
  }

  function splitCells(line) {
    let row = line.trim();
    if (row.startsWith("|")) row = row.slice(1);
    if (row.endsWith("|")) row = row.slice(0, -1);
    return row.split("|").map((cell) => cell.trim());
  }

  function parse(lines) {
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const start = i;
      const line = lines[i];

      if (!line.trim()) {
        i += 1;
        continue;
      }

      const fence = fenceAt(line);
      if (fence) {
        const body = [];
        i += 1;
        while (i < lines.length) {
          const close = fenceAt(lines[i]);
          if (close && close.char === fence.char && close.len >= fence.len && !close.info) {
            break;
          }
          body.push(lines[i]);
          i += 1;
        }
        if (i < lines.length) i += 1;
        blocks.push({ type: "code", text: body.join("\n") });
        continue;
      }

      const heading = headingAt(line);
      if (heading) {
        blocks.push({ type: "heading", level: heading.level, text: heading.text });
        i += 1;
        continue;
      }

      if (isHr(line)) {
        blocks.push({ type: "hr" });
        i += 1;
        continue;
      }

      if (isQuote(line)) {
        const quoted = [];
        while (i < lines.length && (isQuote(lines[i]) || (quoted.length && !lines[i].trim()))) {
          if (!lines[i].trim() && (i + 1 >= lines.length || !isQuote(lines[i + 1]))) break;
          quoted.push(lines[i].replace(/^ {0,3}>\s?/, ""));
          i += 1;
        }
        blocks.push({ type: "quote", blocks: parse(quoted) });
        continue;
      }

      if (isTableStart(lines, i)) {
        const header = splitCells(lines[i]);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
          rows.push(splitCells(lines[i]));
          i += 1;
        }
        blocks.push({ type: "table", header, rows });
        continue;
      }

      const item = listAt(line);
      if (item && item.indent === 0) {
        const parsed = parseList(lines, i, 0);
        blocks.push(parsed.block);
        i = parsed.next;
        if (i === start) i += 1;
        continue;
      }

      const para = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !fenceAt(lines[i]) &&
        !headingAt(lines[i]) &&
        !isHr(lines[i]) &&
        !isQuote(lines[i]) &&
        !listAt(lines[i]) &&
        !isTableStart(lines, i)
      ) {
        para.push(lines[i]);
        i += 1;
      }
      if (para.length) blocks.push({ type: "p", lines: para });
      if (i === start) i += 1;
    }

    return blocks;
  }

  function parseList(lines, start, indent) {
    const items = [];
    let ordered = null;
    let firstMarker = "";
    let i = start;

    while (i < lines.length) {
      const here = i;
      if (!lines[i].trim()) break;
      const item = listAt(lines[i]);
      if (!item || item.indent < indent) break;

      if (item.indent > indent) {
        if (!items.length) break;
        const nested = parseList(lines, i, item.indent);
        if (nested.next === i) break;
        items[items.length - 1].blocks.push(nested.block);
        i = nested.next;
        if (i === here) break;
        continue;
      }

      const isOrdered = /^\d/.test(item.marker);
      if (ordered === null) {
        ordered = isOrdered;
        firstMarker = item.marker;
      }
      if (isOrdered !== ordered) break;

      let text = item.text;
      let checked = null;
      if (!isOrdered) {
        const task = /^\[([ xX])\]\s*(.*)$/.exec(text);
        if (task) {
          checked = task[1].toLowerCase() === "x";
          text = task[2];
        }
      }

      i += 1;
      const continued = [];
      while (i < lines.length && /^ {2,}\S/.test(lines[i]) && !listAt(lines[i]) && !fenceAt(lines[i])) {
        continued.push(lines[i].trim());
        i += 1;
      }
      if (continued.length) text = `${text} ${continued.join(" ")}`;
      items.push({ text, checked, blocks: [] });
      if (i === here) break;
    }

    let startAt = 1;
    if (ordered) {
      const n = Number(/^(\d+)/.exec(firstMarker)[1]);
      if (Number.isInteger(n) && n > 1 && n < 10000) startAt = n;
    }

    return {
      block: { type: "list", ordered: Boolean(ordered), start: startAt, items },
      next: i,
    };
  }

  function hardBreak(line) {
    if (line.endsWith("\\") && !line.endsWith("\\\\")) return { text: line.slice(0, -1), hard: true };
    if (line.endsWith("  ")) return { text: line.slice(0, -2), hard: true };
    return { text: line, hard: false };
  }

  function renderBlocks(blocks) {
    return blocks.map(renderBlock).join("\n");
  }

  function renderBlock(block) {
    if (block.type === "heading") {
      const level = block.level;
      return `<h${level}>${inline(block.text)}</h${level}>`;
    }
    if (block.type === "hr") return "<hr>";
    if (block.type === "code") return `<pre><code>${esc(block.text)}</code></pre>`;
    if (block.type === "quote") return `<blockquote>${renderBlocks(block.blocks)}</blockquote>`;
    if (block.type === "table") {
      const head = block.header.map((cell) => `<th>${inline(cell)}</th>`).join("");
      const body = block.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`)
        .join("");
      return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    }
    if (block.type === "list") {
      const tag = block.ordered ? "ol" : "ul";
      const startAttr = block.ordered && block.start > 1 ? ` start="${block.start}"` : "";
      const items = block.items
        .map((item) => {
          const box =
            item.checked === null
              ? ""
              : `<input type="checkbox" disabled${item.checked ? " checked" : ""}> `;
          const nested = item.blocks.length ? renderBlocks(item.blocks) : "";
          return `<li>${box}${inline(item.text)}${nested}</li>`;
        })
        .join("");
      return `<${tag}${startAttr}>${items}</${tag}>`;
    }

    const parts = [];
    block.lines.forEach((line, index) => {
      const piece = hardBreak(line);
      parts.push(inline(piece.text));
      if (index < block.lines.length - 1) parts.push(piece.hard ? "<br>" : " ");
    });
    return `<p>${parts.join("")}</p>`;
  }

  function render(markdown) {
    const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
    return renderBlocks(parse(lines)).trim();
  }

  function preview(markdown) {
    const text = String(markdown ?? "");
    if (text.length > MAX_CHARS) {
      return {
        html: "",
        error: "This is too long to preview. Keep it under 400,000 characters.",
      };
    }
    return { html: render(text), error: "" };
  }

  globalThis.MarkdownPreview = { MAX_CHARS, render, preview };
})();
