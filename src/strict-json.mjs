function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

// JSON.parse keeps only the last value for duplicate object keys. Contract
// boundaries must reject those documents before parsing so an attacker cannot
// present two meanings to different consumers.
export function parseStrictJson(text, { maximumBytes = 262_144, maximumDepth = 64 } = {}) {
  if (typeof text !== 'string') fail('JSON_INPUT_MUST_BE_STRING');
  if (Buffer.byteLength(text) > maximumBytes) fail('JSON_INPUT_TOO_LARGE');
  let cursor = 0;

  const skipWhitespace = () => {
    while (cursor < text.length && /[\u0009\u000a\u000d\u0020]/.test(text[cursor])) cursor += 1;
  };

  const parseStringToken = () => {
    if (text[cursor] !== '"') fail('JSON_SYNTAX_INVALID');
    const start = cursor;
    cursor += 1;
    let escaped = false;
    while (cursor < text.length) {
      const character = text[cursor];
      if (!escaped && character === '"') {
        cursor += 1;
        try {
          return JSON.parse(text.slice(start, cursor));
        } catch {
          fail('JSON_STRING_INVALID');
        }
      }
      if (!escaped && character.charCodeAt(0) < 0x20) fail('JSON_STRING_INVALID');
      if (!escaped && character === '\\') escaped = true;
      else escaped = false;
      cursor += 1;
    }
    fail('JSON_STRING_UNTERMINATED');
  };

  const parsePrimitive = () => {
    const rest = text.slice(cursor);
    const literal = /^(?:true|false|null)/.exec(rest);
    if (literal) {
      cursor += literal[0].length;
      return;
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(rest);
    if (!number) fail('JSON_SYNTAX_INVALID');
    cursor += number[0].length;
  };

  const parseValue = depth => {
    if (depth > maximumDepth) fail('JSON_NESTING_TOO_DEEP');
    skipWhitespace();
    if (text[cursor] === '"') {
      parseStringToken();
      return;
    }
    if (text[cursor] === '{') {
      parseObject(depth + 1);
      return;
    }
    if (text[cursor] === '[') {
      parseArray(depth + 1);
      return;
    }
    parsePrimitive();
  };

  const parseObject = depth => {
    cursor += 1;
    skipWhitespace();
    const keys = new Set();
    if (text[cursor] === '}') {
      cursor += 1;
      return;
    }
    while (cursor < text.length) {
      skipWhitespace();
      const key = parseStringToken();
      if (keys.has(key)) fail('JSON_DUPLICATE_OBJECT_KEY');
      keys.add(key);
      skipWhitespace();
      if (text[cursor] !== ':') fail('JSON_SYNTAX_INVALID');
      cursor += 1;
      parseValue(depth);
      skipWhitespace();
      if (text[cursor] === '}') {
        cursor += 1;
        return;
      }
      if (text[cursor] !== ',') fail('JSON_SYNTAX_INVALID');
      cursor += 1;
    }
    fail('JSON_OBJECT_UNTERMINATED');
  };

  const parseArray = depth => {
    cursor += 1;
    skipWhitespace();
    if (text[cursor] === ']') {
      cursor += 1;
      return;
    }
    while (cursor < text.length) {
      parseValue(depth);
      skipWhitespace();
      if (text[cursor] === ']') {
        cursor += 1;
        return;
      }
      if (text[cursor] !== ',') fail('JSON_SYNTAX_INVALID');
      cursor += 1;
    }
    fail('JSON_ARRAY_UNTERMINATED');
  };

  try {
    parseValue(0);
    skipWhitespace();
    if (cursor !== text.length) fail('JSON_TRAILING_CONTENT');
    return JSON.parse(text);
  } catch (error) {
    if (error?.code) throw error;
    fail('JSON_SYNTAX_INVALID');
  }
}
