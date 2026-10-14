function stripBom(text) {
  const source = String(text);
  return source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
}

function svgDownloadName(fileName) {
  const base = String(fileName || "gerber").split(/[/\\]/).pop();
  const stem = base.replace(/\.[^.]+$/, "");
  const cleaned = stem
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return `${cleaned || "gerber"}.svg`;
}

function isJobFile(fileName) {
  return /\.gbrjob$/i.test(String(fileName || ""));
}

function looksBinary(text) {
  return String(text).includes("\u0000");
}

function readViewBox(svg) {
  const match = /viewBox="([^"]*)"/.exec(String(svg || ""));
  if (!match) return null;
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) return null;
  return parts;
}

function isEmptySvg(svg) {
  const box = readViewBox(svg);
  if (!box) return true;
  return box[2] === 0 && box[3] === 0;
}

// Share of the longer side left empty around the artwork, in addition to any
// stroke that would otherwise be clipped by a tight viewBox.
const MARGIN_RATIO = 0.05;

function maxStrokeWidth(svg) {
  let max = 0;
  const pattern = /stroke-width="([0-9.]+)"/g;
  let match = pattern.exec(svg);
  while (match) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > max) max = value;
    match = pattern.exec(svg);
  }
  return max;
}

function formatSize(value) {
  return String(Math.round(value * 1000) / 1000);
}

function padSvg(svg) {
  const box = readViewBox(svg);
  if (!box || box[2] === 0 || box[3] === 0) return svg;

  const [x, y, width, height] = box;
  const pad = Math.max(Math.max(width, height) * MARGIN_RATIO, maxStrokeWidth(svg) / 2);
  if (!(pad > 0)) return svg;

  const nextBox = [x - pad, y - pad, width + pad * 2, height + pad * 2];
  const tagEnd = svg.indexOf(">");
  if (tagEnd === -1) return svg;

  const extra = (pad * 2) / 1000;
  const open = svg.slice(0, tagEnd).replace(
    /viewBox="[^"]*"/,
    `viewBox="${nextBox.join(" ")}"`,
  );
  const sized = open.replace(
    /(?<![\w-])(width|height)="([0-9.]+)(mm|in)?"/g,
    (full, attr, number, unit) => {
      const size = Number(number);
      if (!Number.isFinite(size)) return full;
      return `${attr}="${formatSize(size + extra)}${unit || ""}"`;
    },
  );
  return sized + svg.slice(tagEnd);
}

const HAIRLINE_MM = 0.05;

function fmt(value) {
  const rounded = Math.round(value * 10000) / 10000;
  if (Object.is(rounded, -0)) return "0";
  return String(rounded);
}

function tagAttrs(tag) {
  const map = {};
  const pattern = /([\w:-]+)="([^"]*)"/g;
  let match = pattern.exec(tag);
  while (match) {
    map[match[1]] = match[2];
    match = pattern.exec(tag);
  }
  return map;
}

function documentSize(svg) {
  const openEnd = svg.indexOf(">");
  const open = openEnd === -1 ? svg : svg.slice(0, openEnd);
  const box = readViewBox(open);
  const width = /(?<![\w-])width="([0-9.]+)(mm|in)?"/.exec(open);
  const height = /(?<![\w-])height="([0-9.]+)(mm|in)?"/.exec(open);
  if (!box || !width || !height) return null;
  const widthValue = Number(width[1]);
  const heightValue = Number(height[1]);
  if (!(widthValue > 0) || !(heightValue > 0)) return null;
  return {
    box,
    width: widthValue,
    height: heightValue,
    unit: width[2] || height[2] || "mm",
  };
}

function layerFlip(svg) {
  const match = /translate\(\s*([\d.eE+-]+)\s*,\s*([\d.eE+-]+)\s*\)\s*scale\(\s*1\s*,\s*-1\s*\)/.exec(svg);
  if (!match) return null;
  return { tx: Number(match[1]), ty: Number(match[2]) };
}

function mapPoint(x, y, flip, size) {
  const xt = flip ? x + flip.tx : x;
  const yt = flip ? -y + flip.ty : y;
  const [boxX, boxY, boxWidth, boxHeight] = size.box;
  return [
    ((xt - boxX) / boxWidth) * size.width,
    ((yt - boxY) / boxHeight) * size.height,
  ];
}

function mapLength(length, size, axis) {
  const [, , boxWidth, boxHeight] = size.box;
  const span = axis === "y" ? boxHeight : boxWidth;
  const sizeValue = axis === "y" ? size.height : size.width;
  return (length / span) * sizeValue;
}

function tokenizePath(d) {
  const tokens = [];
  const pattern = /([MLHVZACSQT])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/gi;
  let match = pattern.exec(d);
  while (match) {
    tokens.push(match[1] ? match[1] : Number(match[2]));
    match = pattern.exec(d);
  }
  return tokens;
}

function pathToMm(d, flip, size) {
  const tokens = tokenizePath(d);
  let index = 0;
  let command = "";
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const parts = [];
  let start = null;
  let last = null;

  function take(count) {
    const values = [];
    for (let i = 0; i < count; i += 1) values.push(tokens[index + i]);
    index += count;
    return values;
  }

  function moveTo(x, y) {
    const [mx, my] = mapPoint(x, y, flip, size);
    parts.push(`M ${fmt(mx)} ${fmt(my)}`);
    start = [mx, my];
    last = [mx, my];
    cx = x;
    cy = y;
    sx = x;
    sy = y;
  }

  function lineTo(x, y) {
    const [mx, my] = mapPoint(x, y, flip, size);
    parts.push(`L ${fmt(mx)} ${fmt(my)}`);
    last = [mx, my];
    cx = x;
    cy = y;
  }

  while (index < tokens.length) {
    if (typeof tokens[index] === "string") command = tokens[index++];
    if (!command || index > tokens.length) break;
    const upper = command.toUpperCase();
    const absolute = command === upper;

    if (upper === "M") {
      const [x, y] = take(2);
      moveTo(absolute ? x : cx + x, absolute ? y : cy + y);
      command = absolute ? "L" : "l";
    } else if (upper === "L") {
      const [x, y] = take(2);
      lineTo(absolute ? x : cx + x, absolute ? y : cy + y);
    } else if (upper === "H") {
      const [x] = take(1);
      lineTo(absolute ? x : cx + x, cy);
    } else if (upper === "V") {
      const [y] = take(1);
      lineTo(cx, absolute ? y : cy + y);
    } else if (upper === "A") {
      const [rx, ry, rotation, large, sweep, x, y] = take(7);
      const ax = absolute ? x : cx + x;
      const ay = absolute ? y : cy + y;
      const [mx, my] = mapPoint(ax, ay, flip, size);
      const nextSweep = flip ? (Number(sweep) === 0 ? 1 : 0) : sweep;
      parts.push(
        `A ${fmt(mapLength(rx, size, "x"))} ${fmt(mapLength(ry, size, "y"))} ${rotation} ${large} ${nextSweep} ${fmt(mx)} ${fmt(my)}`,
      );
      last = [mx, my];
      cx = ax;
      cy = ay;
    } else if (upper === "Z") {
      parts.push("Z");
      last = start;
      cx = sx;
      cy = sy;
    } else {
      break;
    }
  }

  if (start && last && parts[parts.length - 1] !== "Z") {
    const closed = Math.abs(start[0] - last[0]) < 0.0002 && Math.abs(start[1] - last[1]) < 0.0002;
    if (closed) {
      if (parts[parts.length - 1].startsWith("L")) parts.pop();
      parts.push("Z");
    }
  }

  return parts.join(" ");
}

function pointsToPath(points) {
  const [first, ...rest] = points;
  return [`M ${fmt(first[0])} ${fmt(first[1])}`, ...rest.map(([x, y]) => `L ${fmt(x)} ${fmt(y)}`), "Z"].join(" ");
}

function shapePath(shape, useX, useY, flip, size) {
  const { kind, attr } = shape;
  if (kind === "rect") {
    const x = Number(attr.x || 0) + useX;
    const y = Number(attr.y || 0) + useY;
    const width = Number(attr.width);
    const height = Number(attr.height);
    return pointsToPath([
      mapPoint(x, y, flip, size),
      mapPoint(x + width, y, flip, size),
      mapPoint(x + width, y + height, flip, size),
      mapPoint(x, y + height, flip, size),
    ]);
  }
  if (kind === "circle") {
    const cx = Number(attr.cx || 0) + useX;
    const cy = Number(attr.cy || 0) + useY;
    const [mx, my] = mapPoint(cx, cy, flip, size);
    const rx = mapLength(Number(attr.r), size, "x");
    const ry = mapLength(Number(attr.r), size, "y");
    const left = mx - rx;
    const right = mx + rx;
    return `M ${fmt(left)} ${fmt(my)} A ${fmt(rx)} ${fmt(ry)} 0 1 1 ${fmt(right)} ${fmt(my)} A ${fmt(rx)} ${fmt(ry)} 0 1 1 ${fmt(left)} ${fmt(my)} Z`;
  }
  if (kind === "polygon") {
    const nums = String(attr.points || "")
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const points = [];
    for (let i = 0; i < nums.length; i += 2) {
      points.push(mapPoint(nums[i] + useX, nums[i + 1] + useY, flip, size));
    }
    return points.length ? pointsToPath(points) : "";
  }
  return "";
}

function strokeMm(tag, size) {
  const raw = tagAttrs(tag)["stroke-width"];
  const width = raw == null ? 0 : Number(raw);
  if (!Number.isFinite(width) || width <= 0) return HAIRLINE_MM;
  return mapLength(width, size, "x");
}

// gerber-to-svg draws in 1000× file units, flips Y, and clones pads with <use>.
// LightBurn skips that: it wants one user unit per millimetre, a real stroke, and
// ordinary paths. Rewrite the drawing into that form.
function normalizeSvg(svg) {
  if (isEmptySvg(svg)) return svg;
  const size = documentSize(svg);
  if (!size) return svg;
  const flip = layerFlip(svg);

  const defs = {};
  const defsHtml = (svg.match(/<defs>[\s\S]*?<\/defs>/) || [""])[0];
  for (const match of defsHtml.matchAll(/<(rect|circle|polygon)\b[^>]*\/?>/g)) {
    const attr = tagAttrs(match[0]);
    if (attr.id) defs[attr.id] = { kind: match[1], attr };
  }

  const layer = (svg.match(/<g\b[^>]*>[\s\S]*<\/g>/) || [svg])[0];
  const paths = [];

  for (const match of layer.matchAll(/<use\b[^>]*\/?>/g)) {
    const attr = tagAttrs(match[0]);
    const href = (attr["xlink:href"] || attr.href || "").replace(/^#/, "");
    const shape = defs[href];
    if (!shape) continue;
    const d = shapePath(shape, Number(attr.x || 0), Number(attr.y || 0), flip, size);
    if (d) paths.push({ d, stroke: HAIRLINE_MM });
  }

  for (const match of layer.matchAll(/<path\b[^>]*\/?>/g)) {
    const attr = tagAttrs(match[0]);
    if (!attr.d) continue;
    const d = pathToMm(attr.d, flip, size);
    if (d) paths.push({ d, stroke: strokeMm(match[0], size) });
  }

  if (!paths.length) return svg;

  const body = paths
    .map((path) => `<path d="${path.d}" stroke="#000000" stroke-width="${fmt(path.stroke)}"/>`)
    .join("");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round" stroke-linejoin="round" ` +
    `width="${fmt(size.width)}${size.unit}" height="${fmt(size.height)}${size.unit}" ` +
    `viewBox="0 0 ${fmt(size.width)} ${fmt(size.height)}">${body}</svg>`
  );
}

function convertGerber(text, id) {
  const source = stripBom(text);
  return new Promise((resolve, reject) => {
    if (typeof gerberToSvg !== "function") {
      reject(new Error("The Gerber converter did not load."));
      return;
    }
    try {
      gerberToSvg(source, { id: id || "layer" }, (error, svg) => {
        if (error) reject(error);
        else resolve(normalizeSvg(padSvg(svg)));
      });
    } catch (error) {
      reject(error);
    }
  });
}

const Gerber = {
  stripBom,
  svgDownloadName,
  isJobFile,
  looksBinary,
  isEmptySvg,
  padSvg,
  convertGerber,
};

globalThis.Gerber = Gerber;
