// Case, whitespace and curly-quote differences are ignored when matching, since
// the model often reflows a sentence or straightens quotes while quoting it.
const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

// Keep an AI-reported source excerpt only when it really appears in the document.
// An excerpt the model paraphrased or invented is dropped (null) rather than
// stored as if it were traceable evidence.
export function verifiedSource(source: unknown, documentText: string): string | null {
  if (typeof source !== 'string' || !source.trim()) return null;
  return normalize(documentText || '').includes(normalize(source)) ? source.trim() : null;
}
