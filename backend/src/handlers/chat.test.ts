import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/connection', () => ({ query: vi.fn() }));
vi.mock('./ai', () => ({ callBedrock: vi.fn() }));
vi.mock('../utils/embeddings', () => ({ embedText: vi.fn(), toVectorLiteral: vi.fn() }));

import { query } from '../db/connection';
import { keywordFallback } from './chat';

const docs = [
  { id: 1, title: 'Budget review', extracted_text: 'The marketing budget was approved for the fourth quarter.' },
  { id: 2, title: 'Hiring plan', extracted_text: 'Two backend engineers will be hired in November.' },
];

describe('keywordFallback', () => {
  beforeEach(() => {
    vi.mocked(query).mockReset();
    vi.mocked(query).mockResolvedValue({ rows: docs } as any);
  });

  it('returns only the documents that contain a keyword', async () => {
    const result = await keywordFallback(1, 1, ['budget']);
    expect(result.map(d => d.id)).toEqual([1]);
  });

  it('returns nothing when no document matches, so the chat declines', async () => {
    expect(await keywordFallback(1, 1, ['kubernetes'])).toEqual([]);
  });

  it('returns nothing when the question has no keywords', async () => {
    expect(await keywordFallback(1, 1, [])).toEqual([]);
  });

  it('ranks the document with more keyword matches first', async () => {
    const result = await keywordFallback(1, 1, ['backend', 'engineers', 'budget']);
    expect(result.map(d => d.id)).toEqual([2, 1]);
  });
});
