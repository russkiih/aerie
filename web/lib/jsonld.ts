/**
 * Serialize a JSON-LD object for embedding in a <script type="application/ld+json"> tag.
 * Escapes <, > and & (so a value containing "</script>" or "<!--" cannot break out of the
 * tag) and the line/paragraph separators U+2028/U+2029, which are valid JSON but not valid
 * raw in a script body. Characters are built from code points so none has to appear
 * literally in this file.
 */
const ESCAPES: [string, string][] = [0x3c, 0x3e, 0x26, 0x2028, 0x2029].map((code) => [
  String.fromCharCode(code),
  String.fromCharCode(0x5c) + "u" + code.toString(16).padStart(4, "0"),
]);

export function serializeJsonLd(data: unknown): string {
  let out = JSON.stringify(data) ?? "";
  for (const [ch, esc] of ESCAPES) out = out.split(ch).join(esc);
  return out;
}
