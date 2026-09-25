(function (global) {
  const MIN_LENGTH = 8;
  const MAX_LENGTH = 64;
  const DEFAULT_LENGTH = 20;

  const GROUP_ORDER = [
    "lowercase",
    "uppercase",
    "numbers",
    "common",
    "safeExtras",
    "extra",
    "rarelyAccepted",
  ];

  const GROUPS = {
    lowercase: {
      id: "lowercase",
      label: "Lowercase",
      chars: "abcdefghijklmnopqrstuvwxyz",
    },
    uppercase: {
      id: "uppercase",
      label: "Uppercase",
      chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    },
    numbers: {
      id: "numbers",
      label: "Numbers",
      chars: "0123456789",
    },
    common: {
      id: "common",
      label: "Common",
      chars: "!@#$%^&*",
    },
    safeExtras: {
      id: "safeExtras",
      label: "Safe extras",
      chars: "-_.+=",
    },
    extra: {
      id: "extra",
      label: "Extra",
      chars: "()[]{},;:?/",
    },
    rarelyAccepted: {
      id: "rarelyAccepted",
      label: "Rarely accepted",
      chars: "'\"`\\|~<> ",
    },
  };

  const SIMILAR_CHARS = "0Oo1lI|";

  const DEFAULT_OPTIONS = {
    length: DEFAULT_LENGTH,
    lowercase: true,
    uppercase: true,
    numbers: true,
    common: true,
    safeExtras: true,
    extra: false,
    rarelyAccepted: false,
    excludeSimilar: false,
  };

  function defaultGetRandomValues(typedArray) {
    const cryptoObj = global.crypto;
    if (!cryptoObj || typeof cryptoObj.getRandomValues !== "function") {
      throw new Error("Secure random number generator is not available in this browser.");
    }
    return cryptoObj.getRandomValues(typedArray);
  }

  function filterSimilar(chars, excludeSimilar) {
    if (!excludeSimilar) return chars;
    let next = "";
    for (const ch of chars) {
      if (!SIMILAR_CHARS.includes(ch)) next += ch;
    }
    return next;
  }

  function enabledGroups(options) {
    const groups = [];
    for (const id of GROUP_ORDER) {
      if (!options[id]) continue;
      const chars = filterSimilar(GROUPS[id].chars, Boolean(options.excludeSimilar));
      if (!chars) continue;
      groups.push({ id, chars });
    }
    return groups;
  }

  function buildCharset(options) {
    const groups = enabledGroups(options);
    const seen = new Set();
    let charset = "";
    for (const group of groups) {
      for (const ch of group.chars) {
        if (seen.has(ch)) continue;
        seen.add(ch);
        charset += ch;
      }
    }
    return { charset, groups };
  }

  function pickUniformIndex(length, getRandomValues) {
    if (!Number.isInteger(length) || length < 1) {
      throw new Error("Invalid charset length.");
    }
    const rng = getRandomValues || defaultGetRandomValues;
    const bound = 0x100000000;
    const limit = bound - (bound % length);
    const buf = new Uint32Array(1);
    for (let attempt = 0; attempt < 64; attempt += 1) {
      rng(buf);
      const value = buf[0] >>> 0;
      if (value < limit) {
        return value % length;
      }
    }
    throw new Error("Failed to sample a uniform random index.");
  }

  function pickChar(chars, getRandomValues) {
    return chars[pickUniformIndex(chars.length, getRandomValues)];
  }

  function entropyBits(length, charsetSize) {
    if (length < 1 || charsetSize < 1) return 0;
    return length * Math.log2(charsetSize);
  }

  function strengthLabel(bits) {
    if (bits < 40) return "weak";
    if (bits < 60) return "ok";
    if (bits < 80) return "strong";
    return "very strong";
  }

  function normalizeLength(value) {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.round(n);
  }

  function generatePassword(options, getRandomValues) {
    const length = normalizeLength(options && options.length);
    if (length === null || length < MIN_LENGTH || length > MAX_LENGTH) {
      return {
        ok: false,
        error: `Length must be between ${MIN_LENGTH} and ${MAX_LENGTH}.`,
      };
    }

    const { charset, groups } = buildCharset(options || {});
    if (!charset) {
      return { ok: false, error: "Select at least one character set." };
    }

    if (length < groups.length) {
      return {
        ok: false,
        error: `Length must be at least ${groups.length} for the selected sets.`,
      };
    }

    try {
      const chars = [];
      for (let i = 0; i < length; i += 1) {
        chars.push(pickChar(charset, getRandomValues));
      }

      const unused = [];
      for (let i = 0; i < chars.length; i += 1) unused.push(i);

      for (const group of groups) {
        const present = chars.some((ch) => group.chars.includes(ch));
        if (present) continue;
        const slot = pickUniformIndex(unused.length, getRandomValues);
        const position = unused.splice(slot, 1)[0];
        chars[position] = pickChar(group.chars, getRandomValues);
      }

      const password = chars.join("");
      const bits = entropyBits(length, charset.length);
      return {
        ok: true,
        password,
        charsetSize: charset.length,
        entropyBits: bits,
        groups: groups.map((group) => group.id),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Could not generate a password.",
      };
    }
  }

  global.PasswordGenerator = {
    MIN_LENGTH,
    MAX_LENGTH,
    DEFAULT_LENGTH,
    DEFAULT_OPTIONS,
    GROUP_ORDER,
    GROUPS,
    SIMILAR_CHARS,
    enabledGroups,
    buildCharset,
    pickUniformIndex,
    entropyBits,
    strengthLabel,
    generatePassword,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
