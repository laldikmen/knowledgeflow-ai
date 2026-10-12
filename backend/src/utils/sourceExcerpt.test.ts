import { describe, expect, it } from 'vitest';
import { verifiedSource } from './sourceExcerpt';

const doc = `Weekly sync, 4 August.
Ayşe will send the “vendor shortlist” to finance by Friday.
We decided to postpone   the launch to October.`;

describe('verifiedSource', () => {
  it('keeps an excerpt that appears verbatim in the document', () => {
    expect(verifiedSource('We decided to postpone   the launch to October.', doc)).toBe(
      'We decided to postpone   the launch to October.',
    );
  });

  it('ignores case, whitespace and curly-quote differences', () => {
    expect(verifiedSource('ayşe will send the "vendor shortlist"\n to finance', doc)).toBe(
      'ayşe will send the "vendor shortlist"\n to finance',
    );
  });

  it('drops an excerpt that is not in the document', () => {
    expect(verifiedSource('The launch was cancelled.', doc)).toBeNull();
  });

  it('drops missing, empty and non-string sources', () => {
    expect(verifiedSource(undefined, doc)).toBeNull();
    expect(verifiedSource(null, doc)).toBeNull();
    expect(verifiedSource('   ', doc)).toBeNull();
    expect(verifiedSource(42, doc)).toBeNull();
  });

  it('drops everything when the document has no text', () => {
    expect(verifiedSource('anything', '')).toBeNull();
  });
});
