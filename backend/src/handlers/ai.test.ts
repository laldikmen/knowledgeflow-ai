import { describe, expect, it, vi } from 'vitest';

vi.mock('../db/connection', () => ({ query: vi.fn() }));

import { extractJson } from './ai';

describe('extractJson', () => {
  it('returns bare JSON unchanged', () => {
    expect(extractJson(' {"summary":"ok"} ')).toBe('{"summary":"ok"}');
  });

  it('unwraps a ```json fenced block', () => {
    expect(extractJson('Here you go:\n```json\n{"summary":"ok"}\n```')).toBe('{"summary":"ok"}');
  });

  it('unwraps a fenced block with no language tag', () => {
    expect(extractJson('```\n{"a":1}\n```')).toBe('{"a":1}');
  });
});
