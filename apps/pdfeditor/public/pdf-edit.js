(function () {
  const MAX_PDF_BYTES = 20 * 1024 * 1024;

  function editError(message, code) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function lib() {
    const pdfLib = globalThis.PDFLib;
    if (!pdfLib || typeof pdfLib.PDFDocument === "undefined") {
      throw editError("The PDF library did not load.", "library");
    }
    return pdfLib;
  }

  function checkFileSize(size) {
    if (!Number.isFinite(size) || size <= 0) {
      return { ok: false, error: "This file is empty." };
    }
    if (size > MAX_PDF_BYTES) {
      return { ok: false, error: "PDF files have to be 20 MB or smaller." };
    }
    return { ok: true };
  }

  function hasPdfHeader(bytes) {
    if (!bytes || bytes.length < 5) return false;
    const length = Math.min(bytes.length, 1024);
    let text = "";
    for (let index = 0; index < length; index += 1) {
      text += String.fromCharCode(bytes[index]);
    }
    return text.includes("%PDF-");
  }

  function downloadName(filename) {
    const base = String(filename || "")
      .split(/[/\\]/)
      .pop()
      .replace(/^\.+/, "")
      .trim()
      .replace(/[\u0000-\u001f]/g, "");
    if (!base) return "document.pdf";
    return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
  }

  function nextBoxName(names) {
    const used = new Set(names);
    let number = 1;
    let name = "TextBox1";
    while (used.has(name)) {
      number += 1;
      name = `TextBox${number}`;
    }
    return name;
  }

  function clampRect(rect, page) {
    const minSize = 12;
    let width = Math.max(minSize, rect.width);
    let height = Math.max(minSize, rect.height);
    if (width > page.width) width = page.width;
    if (height > page.height) height = page.height;
    let x = rect.x;
    let y = rect.y;
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + width > page.width) x = Math.max(0, page.width - width);
    if (y + height > page.height) y = Math.max(0, page.height - height);
    return { x, y, width, height };
  }

  function defaultNewBox(page, index) {
    const width = Math.min(180, Math.max(40, page.width - 72));
    const height = 28;
    const row = (index || 0) % 8;
    return clampRect(
      {
        x: 36,
        y: page.height - 64 - row * (height + 10),
        width,
        height,
      },
      page,
    );
  }

  function fontSizeFromAppearance(appearance) {
    if (!appearance) return null;
    const match = String(appearance).match(/\/\S+\s+([0-9]*\.?[0-9]+)\s+Tf/);
    if (!match) return null;
    const size = Number(match[1]);
    if (!Number.isFinite(size) || size <= 0) return null;
    return size;
  }

  function normalizeRect(rect) {
    const width = Number(rect.width) || 0;
    const height = Number(rect.height) || 0;
    return {
      x: width < 0 ? rect.x + width : rect.x,
      y: height < 0 ? rect.y + height : rect.y,
      width: Math.abs(width),
      height: Math.abs(height),
    };
  }

  function rectsDiffer(a, b) {
    return (
      Math.abs(a.x - b.x) > 0.8 ||
      Math.abs(a.y - b.y) > 0.8 ||
      Math.abs(a.width - b.width) > 0.8 ||
      Math.abs(a.height - b.height) > 0.8
    );
  }

  function boxKey(box) {
    return box.added ? `added:${box.name}` : `${box.name}#${box.widgetIndex}`;
  }

  // A run of page text from PDF.js getTextContent(). Only horizontal, unrotated runs with
  // visible characters can be edited. Coordinates are PDF user space: x and baseline are where
  // the run starts, and rect is the area that gets covered when the run is replaced.
  function textRunFromItem(item, style, fontName) {
    if (!item || typeof item.str !== "string" || !item.str.trim()) return null;
    const [a, b, c, d, e, f] = item.transform || [];
    if (![a, b, c, d, e, f].every(Number.isFinite)) return null;
    if (Math.abs(b) > 0.01 * Math.abs(a) || Math.abs(c) > 0.01 * Math.abs(d) || a <= 0 || d <= 0) return null;
    const fontSize = Math.hypot(c, d);
    const width = Number(item.width) || 0;
    if (fontSize < 2 || width <= 0) return null;
    const family = style && style.fontFamily === "serif" ? "serif" : style && style.fontFamily === "monospace" ? "mono" : "sans";
    const name = String(fontName || "");
    return {
      x: e,
      baseline: f,
      width,
      fontSize,
      text: item.str,
      family,
      bold: /bold|black|heavy|semibold|demi/i.test(name),
      italic: /italic|oblique/i.test(name),
      rect: { x: e - 1, y: f - fontSize * 0.28, width: width + 2, height: fontSize * 1.28 },
    };
  }

  function standardFontName(run) {
    const bold = Boolean(run.bold);
    const italic = Boolean(run.italic);
    if (run.family === "serif") {
      return bold && italic ? "TimesRomanBoldItalic" : bold ? "TimesRomanBold" : italic ? "TimesRomanItalic" : "TimesRoman";
    }
    if (run.family === "mono") {
      return bold && italic ? "CourierBoldOblique" : bold ? "CourierBold" : italic ? "CourierOblique" : "Courier";
    }
    return bold && italic ? "HelveticaBoldOblique" : bold ? "HelveticaBold" : italic ? "HelveticaOblique" : "Helvetica";
  }

  function changedTextEdits(textEdits) {
    return (textEdits || []).filter((edit) => (edit.text || "") !== (edit.original || ""));
  }

  function hasChanges(originalBoxes, boxes, textEdits, images) {
    if (changedTextEdits(textEdits).length) return true;
    if (images && images.length) return true;
    const originalByKey = new Map(originalBoxes.map((box) => [boxKey(box), box]));
    const seen = new Set();
    for (const box of boxes) {
      const key = boxKey(box);
      seen.add(key);
      if (box.added) return true;
      const original = originalByKey.get(key);
      if (!original) return true;
      if ((original.text || "") !== (box.text || "")) return true;
      if (rectsDiffer(original, box)) return true;
    }
    for (const original of originalBoxes) {
      if (!seen.has(boxKey(original))) return true;
    }
    return false;
  }

  function loadError(error) {
    const message = String((error && error.message) || "");
    if ((error && error.name === "EncryptedPDFError") || /is encrypted/i.test(message)) {
      return editError("This PDF is password protected, so it can't be edited here.", "encrypted");
    }
    return editError("This file couldn't be read as a PDF.", "invalid");
  }

  function saveError(error) {
    const message = String((error && error.message) || "");
    if (/cannot encode|WinAnsi/i.test(message)) {
      return editError(
        "That text uses characters the standard PDF font can't draw. Use Latin letters, numbers, and common punctuation.",
        "font",
      );
    }
    if (/max(?:imum)? length|ExceededMaxLength/i.test(message)) {
      return editError("One text box is over its character limit.", "length");
    }
    if (/comb/i.test(message)) {
      return editError("One text box expects one character in each space.", "comb");
    }
    const failed = editError("The PDF could not be saved.", "save");
    failed.cause = error;
    return failed;
  }

  function loadSummary({ fileName, pageCount, boxCount, hasSignature, skipped }) {
    const pages = pageCount === 1 ? "1 page" : `${pageCount} pages`;
    let message =
      boxCount === 0
        ? `${fileName} is ready. Click any text to change it, or add an image.`
        : `${fileName} is ready. ${boxCount === 1 ? "1 text box" : `${boxCount} text boxes`} across ${pages}.`;
    if (skipped > 0) message += " Password fields and file fields were left unchanged.";
    if (hasSignature) {
      message +=
        " This PDF has a digital signature. Saving changes the file, and the signature will no longer verify.";
    }
    return message;
  }

  function isTextField(pdfLib, field) {
    return typeof pdfLib.PDFTextField === "function" && field instanceof pdfLib.PDFTextField;
  }

  function isSignature(pdfLib, field) {
    return typeof pdfLib.PDFSignature === "function" && field instanceof pdfLib.PDFSignature;
  }

  function pageIndexOf(doc, form, widget) {
    const pages = doc.getPages();
    const ref = typeof widget.P === "function" ? widget.P() : undefined;
    if (ref) {
      const index = pages.findIndex((page) => page.ref === ref);
      if (index >= 0) return index;
    }
    if (typeof form.findWidgetPage === "function") {
      try {
        const page = form.findWidgetPage(widget);
        const index = pages.findIndex((item) => item.ref === page.ref);
        if (index >= 0) return index;
      } catch {
        return 0;
      }
    }
    return 0;
  }

  async function readPdf(bytes) {
    const pdfLib = lib();
    let doc;
    try {
      doc = await pdfLib.PDFDocument.load(bytes, { updateMetadata: false });
    } catch (error) {
      throw loadError(error);
    }

    let pages;
    try {
      pages = doc.getPages();
    } catch {
      throw editError("This file couldn't be read as a PDF.", "invalid");
    }
    if (!pages.length) throw editError("This PDF has no pages.", "invalid");

    let form;
    try {
      form = doc.getForm();
    } catch {
      throw editError("This file couldn't be read as a PDF.", "invalid");
    }
    const boxes = [];
    let hasSignature = false;
    let skipped = 0;

    for (const field of form.getFields()) {
      if (isSignature(pdfLib, field)) {
        hasSignature = true;
        continue;
      }
      if (!isTextField(pdfLib, field)) continue;
      if (field.isPassword() || field.isFileSelector()) {
        skipped += 1;
        continue;
      }

      let text = "";
      try {
        text = field.getText() || "";
      } catch {
        skipped += 1;
        continue;
      }

      const name = field.getName();
      let widgets = [];
      try {
        widgets = field.acroField.getWidgets();
      } catch {
        skipped += 1;
        continue;
      }

      widgets.forEach((widget, widgetIndex) => {
        const rect = normalizeRect(widget.getRectangle());
        if (rect.width < 1 || rect.height < 1) return;
        const appearance = widget.getDefaultAppearance() || field.acroField.getDefaultAppearance() || "";
        boxes.push({
          key: `${name}#${widgetIndex}`,
          name,
          widgetIndex,
          pageIndex: pageIndexOf(doc, form, widget),
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          text,
          multiline: Boolean(field.isMultiline()),
          maxLength: field.getMaxLength() ?? null,
          fontSize: fontSizeFromAppearance(appearance),
          added: false,
        });
      });
    }

    return {
      pageCount: pages.length,
      pageSizes: pages.map((page) => ({ width: page.getWidth(), height: page.getHeight() })),
      boxes,
      hasSignature,
      skipped,
    };
  }

  // Groups changed page text by page and rewrites each page's content stream. Returns the edits
  // whose new text still has to be drawn: "removed" ones in a standard font over the cleared spot,
  // "missing" ones over a cover because the original couldn't be found in the page's content.
  function rewritePageText(pdfLib, doc, pages, textEdits, options) {
    const results = new Map();
    const colors = new Map();
    const borrowed = new Set();
    const byPage = new Map();
    for (const edit of changedTextEdits(textEdits)) {
      if (!pages[edit.pageIndex]) throw editError("That text is on a page this PDF doesn't have.", "range");
      if (!byPage.has(edit.pageIndex)) byPage.set(edit.pageIndex, []);
      byPage.get(edit.pageIndex).push(edit);
    }
    for (const [index, edits] of byPage) {
      let outcome;
      try {
        outcome = globalThis.PdfText
          ? globalThis.PdfText.editPage(pdfLib, doc, pages[index], edits, options)
          : { results: new Map(edits.map((edit) => [edit, "missing"])) };
      } catch {
        outcome = { results: new Map(edits.map((edit) => [edit, "missing"])) };
      }
      for (const [edit, result] of outcome.results) results.set(edit, result);
      if (outcome.colors) for (const [edit, color] of outcome.colors) colors.set(edit, color);
      if (outcome.borrowed) for (const edit of outcome.borrowed) borrowed.add(edit);
    }
    results.colors = colors;
    results.borrowed = borrowed;
    return results;
  }

  // Text edits whose original was removed but whose letters the original font lacks ("removed")
  // are drawn in the closest standard font, in the colour read from the PDF. Throws when a
  // standard font can't draw the text either.
  async function drawInStandardFonts(pdfLib, doc, pages, textEdits, results) {
    const fonts = new Map();
    for (const edit of changedTextEdits(textEdits)) {
      if (results.get(edit) !== "removed") continue;
      const fontName = standardFontName(edit);
      if (!fonts.has(fontName)) fonts.set(fontName, await doc.embedFont(pdfLib.StandardFonts[fontName]));
      // The colour read from the PDF itself comes first; the colour sampled from the screen is a fallback.
      const fg = results.colors.get(edit) || edit.color || [0, 0, 0];
      const text = (edit.text || "").replace(/[\r\n]+/g, " ");
      if (text) {
        pages[edit.pageIndex].drawText(text, {
          x: edit.x,
          y: edit.baseline,
          size: edit.fontSize,
          font: fonts.get(fontName),
          color: pdfLib.rgb(fg[0], fg[1], fg[2]),
        });
      }
    }
  }

  // The page as it will be saved, for showing text edits while they are typed: a one-page PDF
  // holding a copy of the page with the edits written by the same code that saves them. Edits
  // that can't be saved are left out; `applied` holds the ones that are drawn.
  async function previewPage(bytes, pageIndex, edits) {
    const pdfLib = lib();
    const source = await previewSource(bytes);
    const doc = await pdfLib.PDFDocument.create({ updateMetadata: false });
    const [page] = await doc.copyPages(source, source.getPageIndices().filter((index) => index === pageIndex));
    doc.addPage(page);
    const pages = doc.getPages();
    const local = new Map(edits.map((edit) => [{ ...edit, pageIndex: 0 }, edit]));
    const results = rewritePageText(pdfLib, doc, pages, [...local.keys()]);
    const applied = new Set();
    for (const [copy, edit] of local) {
      const result = (copy.text || "") === (copy.original || "") ? "replaced" : results.get(copy) || "missing";
      if (result === "missing") continue;
      if (result === "removed") {
        try {
          pdfLib.StandardFontEmbedder.for(pdfLib.StandardFonts[standardFontName(copy)]).encodeText(copy.text || "");
        } catch {
          // No font can draw it: the original is put back by leaving the edit out of the copy.
          results.set(copy, "missing");
          continue;
        }
      }
      applied.add(edit);
    }
    if ([...local.keys()].some((copy) => results.get(copy) === "missing" && (copy.text || "") !== (copy.original || ""))) {
      // Rewriting is per page, so a page with an edit that can't be drawn is rewritten without it.
      return previewPage(bytes, pageIndex, edits.filter((edit) => applied.has(edit)));
    }
    await drawInStandardFonts(pdfLib, doc, pages, [...local.keys()], results);
    return { bytes: await doc.save(), applied };
  }

  // Cached read-only copy of the open PDF, for checking and drawing edits while they are typed.
  let previewCache = { bytes: null, doc: null };
  function previewSource(bytes) {
    if (previewCache.bytes !== bytes) {
      previewCache = { bytes, doc: lib().PDFDocument.load(bytes.slice(0), { updateMetadata: false }) };
    }
    return previewCache.doc;
  }

  // Says how an edit will be saved: "replaced" (in the original font), "removed" (some letters are
  // not in the original font, so a standard font is used), or "missing".
  async function previewTextEdit(bytes, edit) {
    return (await previewTextEdits(bytes, [edit])).get(edit) || "missing";
  }

  // The same check for many edits at once (find and replace): one dry run per page. Returns a Map
  // from each edit to "replaced" (keeps its original font and look), "removed" (needs a standard
  // font), "missing" (can't be removed from the file), or "unsupported" (no font can draw it).
  async function previewTextEdits(bytes, edits) {
    const pdfLib = lib();
    const modes = new Map();
    let results;
    try {
      const doc = await previewSource(bytes);
      results = rewritePageText(pdfLib, doc, doc.getPages(), edits, { dryRun: true });
    } catch {
      for (const edit of edits) modes.set(edit, "missing");
      return modes;
    }
    for (const edit of edits) {
      let result = (edit.text || "") === (edit.original || "") ? "replaced" : results.get(edit) || "missing";
      if (result === "replaced" && results.borrowed && results.borrowed.has(edit)) result = "borrowed";
      if (result !== "replaced") {
        try {
          pdfLib.StandardFontEmbedder.for(pdfLib.StandardFonts[standardFontName(edit)]).encodeText(edit.text || "");
        } catch {
          result = "unsupported";
        }
      }
      modes.set(edit, result);
    }
    return modes;
  }

  // ---- Leaving no trace of replaced text ---------------------------------------------------
  // A rewritten page gets new streams, but the old ones would stay in the file, unreferenced but
  // readable. The same wording can also sit in metadata, bookmarks, comments, alt text, and field
  // defaults. Before saving, every changed phrase is rewritten wherever it is stored as text, and
  // every object the document no longer uses is deleted.

  const WORD_CHAR = /[\p{L}\p{N}_]/u;

  // The changed part of an edit, widened to whole words: "Dear John Smith," -> "Dear Jane Doe,"
  // gives "John Smith" -> "Jane Doe". Changes of fewer than 3 letters or digits are not used, so a
  // one-digit edit can't rewrite unrelated text elsewhere in the file.
  function changedPhrase(before, after) {
    let start = 0;
    while (start < before.length && start < after.length && before[start] === after[start]) start += 1;
    let end = 0;
    while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end += 1;
    while (start > 0 && WORD_CHAR.test(before[start - 1])) start -= 1;
    while (end > 0 && WORD_CHAR.test(before[before.length - end])) end -= 1;
    const from = before.slice(start, before.length - end).trim();
    const to = after.slice(start, after.length - end).trim();
    return from.replace(/[^\p{L}\p{N}]/gu, "").length >= 3 ? { from, to } : null;
  }

  function changePairs(originalBoxes, boxes, textEdits, extraPairs) {
    const pairs = [];
    const add = (from, to, matchCase = true) => {
      if (!from || from === to) return;
      if (pairs.some((pair) => pair.from === from && pair.matchCase === matchCase)) return;
      pairs.push({ from, to: to || "", matchCase });
    };
    const addEdit = (before, after) => {
      add(before, after);
      const phrase = changedPhrase(before, after);
      if (phrase) add(phrase.from, phrase.to);
    };
    for (const edit of changedTextEdits(textEdits)) addEdit(edit.original || "", edit.text || "");
    const now = new Map(boxes.filter((box) => !box.added).map((box) => [box.name, box.text || ""]));
    for (const box of originalBoxes) {
      if (box.added || !box.text) continue;
      const after = now.has(box.name) ? now.get(box.name) : "";
      if (after !== box.text) addEdit(box.text, after);
    }
    for (const pair of extraPairs || []) add(pair.from, pair.to, pair.matchCase !== false);
    // Longest first, so a whole run is replaced before the phrase inside it.
    return pairs.sort((a, b) => b.from.length - a.from.length);
  }

  function scrubberFor(pairs) {
    const rules = pairs.map(({ from, to, matchCase }) => {
      const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`);
      const before = WORD_CHAR.test(from[0]) ? "(?<![\\p{L}\\p{N}_])" : "";
      const after = WORD_CHAR.test(from[from.length - 1]) ? "(?![\\p{L}\\p{N}_])" : "";
      return { pattern: new RegExp(before + escaped + after, matchCase ? "gu" : "giu"), to };
    });
    return (text) => rules.reduce((value, rule) => value.replace(rule.pattern, () => rule.to), text);
  }

  // Calls visit(container, key, value) for every object reachable from the document's trailer.
  function walkReachable(pdfLib, doc, visit) {
    const context = doc.context;
    const seen = new Set();
    const queue = [];
    const enqueue = (value) => {
      if (value instanceof pdfLib.PDFRef) {
        const tag = value.toString();
        if (seen.has(tag)) return;
        seen.add(tag);
        const target = context.lookup(value);
        if (target) queue.push(target);
      } else if (value) {
        queue.push(value);
      }
    };
    for (const key of ["Root", "Info", "Encrypt"]) enqueue(context.trailerInfo[key]);
    while (queue.length) {
      const object = queue.pop();
      const dict = object instanceof pdfLib.PDFDict ? object : object && object.dict instanceof pdfLib.PDFDict ? object.dict : null;
      if (dict) {
        for (const [key, value] of dict.entries()) {
          if (visit) visit(dict, key, value);
          enqueue(value);
        }
      } else if (object instanceof pdfLib.PDFArray) {
        object.asArray().forEach((value, index) => {
          if (visit) visit(object, index, value);
          enqueue(value);
        });
      }
    }
    return seen;
  }

  function scrubStrings(pdfLib, doc, scrub) {
    walkReachable(pdfLib, doc, (container, key, value) => {
      if (!(value instanceof pdfLib.PDFString || value instanceof pdfLib.PDFHexString)) return;
      let text;
      try {
        text = value.decodeText();
      } catch {
        return;
      }
      const next = scrub(text);
      if (next !== text) container.set(key, pdfLib.PDFHexString.fromText(next));
    });
  }

  // XMP metadata repeats the title and subject as XML. If it mentions a changed phrase, it is
  // dropped rather than edited; the document info keeps the (rewritten) title and author.
  function scrubXmp(pdfLib, doc, scrub) {
    const key = pdfLib.PDFName.of("Metadata");
    const stream = doc.catalog.lookup(key);
    if (!stream) return;
    let text = "";
    try {
      const raw = stream instanceof pdfLib.PDFRawStream ? pdfLib.decodePDFRawStream(stream).decode() : stream.getContents();
      text = new TextDecoder().decode(raw);
    } catch {
      return;
    }
    if (scrub(text) !== text) doc.catalog.delete(key);
  }

  function dropUnreachable(pdfLib, doc) {
    const reachable = walkReachable(pdfLib, doc);
    for (const [ref] of doc.context.enumerateIndirectObjects()) {
      if (!reachable.has(ref.toString())) doc.context.delete(ref);
    }
  }

  // images: [{ pageIndex, x, y, width, height, png }] in PDF user space; png is PNG bytes, with
  // transparency kept, so a signature with its background removed lands on the page as ink only.
  // extraPairs: [{ from, to, matchCase }] from find and replace, scrubbed like the edits' own text.
  async function applyEdits(bytes, originalBoxes, boxes, textEdits, report, images, extraPairs) {
    if (!hasChanges(originalBoxes, boxes, textEdits, images)) return bytes.slice();

    const pdfLib = lib();
    let doc;
    try {
      doc = await pdfLib.PDFDocument.load(bytes, { updateMetadata: false });
    } catch (error) {
      throw loadError(error);
    }

    try {
      const form = doc.getForm();
      const pages = doc.getPages();
      const originalNames = new Set(originalBoxes.filter((box) => !box.added).map((box) => box.name));
      const currentExisting = boxes.filter((box) => !box.added);
      const currentNames = new Set(currentExisting.map((box) => box.name));

      for (const name of originalNames) {
        if (currentNames.has(name)) continue;
        form.removeField(form.getTextField(name));
      }

      for (const name of currentNames) {
        const field = form.getTextField(name);
        const current = currentExisting.filter((box) => box.name === name);
        const original = originalBoxes.filter((box) => box.name === name);
        const nextText = current[0] ? current[0].text || "" : "";
        const previousText = original[0] ? original[0].text || "" : "";
        if (nextText !== previousText) {
          if (field.isReadOnly()) field.disableReadOnly();
          const maxLength = field.getMaxLength();
          const text = maxLength !== undefined && nextText.length > maxLength ? nextText.slice(0, maxLength) : nextText;
          field.setText(text);
          // A field's default value (used by "reset form") would keep the old text otherwise.
          if (field.acroField.dict.has(pdfLib.PDFName.of("DV"))) {
            field.acroField.dict.set(pdfLib.PDFName.of("DV"), pdfLib.PDFHexString.fromText(text));
          }
        }

        const widgets = field.acroField.getWidgets();
        let geometryChanged = false;
        for (const box of current) {
          const widget = widgets[box.widgetIndex];
          if (!widget) continue;
          if (!rectsDiffer(normalizeRect(widget.getRectangle()), box)) continue;
          widget.setRectangle({
            x: box.x,
            y: box.y,
            width: Math.max(8, box.width),
            height: Math.max(8, box.height),
          });
          geometryChanged = true;
        }
        if (geometryChanged && nextText === previousText) field.markAsDirty();
      }

      for (const box of boxes) {
        if (!box.added) continue;
        const page = pages[box.pageIndex];
        if (!page) throw editError("That text box is on a page this PDF doesn't have.", "range");
        const field = form.createTextField(box.name);
        const text = box.text || "";
        if (text) field.setText(text);
        if (box.multiline || box.height >= 36) field.enableMultiline();
        field.addToPage(page, {
          x: box.x,
          y: box.y,
          width: Math.max(8, box.width),
          height: Math.max(8, box.height),
          borderWidth: 0,
        });
        const size = box.fontSize && box.fontSize > 0 ? box.fontSize : 12;
        try {
          field.setFontSize(size);
        } catch {
          /* The box still draws with the default size. */
        }
      }

      // Page text: the original glyphs are deleted from the stream that holds them and the new
      // text is written in their place in the original font. Letters the original font doesn't
      // have are drawn in the closest standard font instead. Text that can't be deleted is refused:
      // covering it would leave the original in the file.
      const pairs = changePairs(originalBoxes, boxes, textEdits, extraPairs);
      const scrub = pairs.length ? scrubberFor(pairs) : null;
      const results = rewritePageText(pdfLib, doc, pages, textEdits, scrub ? { scrub } : undefined);
      const stuck = changedTextEdits(textEdits).filter((edit) => (results.get(edit) || "missing") === "missing");
      if (stuck.length) {
        throw editError(
          `${stuck.length === 1 ? "One text change" : `${stuck.length} text changes`} can't be saved: the original text couldn't be removed from the file. Revert ${stuck.length === 1 ? "it" : "them"} and download again.`,
          "trace",
        );
      }
      if (report) {
        report.replaced = 0;
        report.standardFont = 0;
        report.borrowed = results.borrowed.size;
        for (const edit of changedTextEdits(textEdits)) report[results.get(edit) === "replaced" ? "replaced" : "standardFont"] += 1;
      }
      await drawInStandardFonts(pdfLib, doc, pages, textEdits, results);

      for (const image of images || []) {
        const page = pages[image.pageIndex];
        if (!page) throw editError("That image is on a page this PDF doesn't have.", "range");
        let embedded;
        try {
          embedded = await doc.embedPng(image.png);
        } catch {
          throw editError("One of the images couldn't be added. Try a PNG or JPEG file.", "image");
        }
        page.drawImage(embedded, { x: image.x, y: image.y, width: image.width, height: image.height });
      }

      if (scrub) {
        for (const page of pages) {
          if (globalThis.PdfText) globalThis.PdfText.scrubPage(pdfLib, doc, page, scrub);
        }
        scrubStrings(pdfLib, doc, scrub);
        scrubXmp(pdfLib, doc, scrub);
      }
      // Finish everything that adds objects (field appearances, fonts, images), then delete every
      // object the document no longer uses, such as the streams that held the old text.
      form.updateFieldAppearances();
      await doc.flush();
      dropUnreachable(pdfLib, doc);
      return await doc.save({ updateFieldAppearances: false });
    } catch (error) {
      if (error && error.code) throw error;
      throw saveError(error);
    }
  }

  globalThis.PdfEdit = {
    MAX_PDF_BYTES,
    checkFileSize,
    hasPdfHeader,
    downloadName,
    nextBoxName,
    defaultNewBox,
    clampRect,
    fontSizeFromAppearance,
    rectsDiffer,
    hasChanges,
    textRunFromItem,
    standardFontName,
    changedTextEdits,
    previewTextEdit,
    previewTextEdits,
    previewPage,
    changePairs,
    scrubberFor,
    loadSummary,
    readPdf,
    applyEdits,
  };
})();
