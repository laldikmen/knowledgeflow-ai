import { describe, expect, it, vi } from 'vitest';

vi.mock('../db/connection', () => ({ query: vi.fn() }));

import { chunkText, toVectorLiteral } from './embeddings';

describe('chunkText', () => {
  it('returns no chunks for empty text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n ')).toEqual([]);
  });

  it('returns short text as a single chunk', () => {
    expect(chunkText('  A short note.  ')).toEqual(['A short note.']);
  });

  it('splits long text into chunks no longer than maxChars', () => {
    const text = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} of the meeting notes.`).join(' ');
    const chunks = chunkText(text, 300, 30);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(300);
  });

  it('breaks on a sentence end when one falls in the second half of the window', () => {
    const text = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} of the meeting notes.`).join(' ');
    expect(chunkText(text, 300, 30)[0].endsWith('.')).toBe(true);
  });

  it('overlaps consecutive chunks so no text is lost', () => {
    const text = 'x'.repeat(1000);
    const chunks = chunkText(text, 400, 100);
    expect(chunks.map(c => c.length)).toEqual([400, 400, 400]);
  });
});

describe('toVectorLiteral', () => {
  it('formats an embedding as a pgvector literal', () => {
    expect(toVectorLiteral([0.1, -2, 3])).toBe('[0.1,-2,3]');
  });
});
