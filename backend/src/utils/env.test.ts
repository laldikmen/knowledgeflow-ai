import { afterEach, describe, expect, it } from 'vitest';
import { requireEnv } from './env';

describe('requireEnv', () => {
  afterEach(() => {
    delete process.env.KF_TEST_VAR;
  });

  it('returns the value when the variable is set', () => {
    process.env.KF_TEST_VAR = 'value';
    expect(requireEnv('KF_TEST_VAR')).toBe('value');
  });

  it('throws when the variable is missing', () => {
    expect(() => requireEnv('KF_TEST_VAR')).toThrow('KF_TEST_VAR');
  });

  it('throws when the variable is empty', () => {
    process.env.KF_TEST_VAR = '';
    expect(() => requireEnv('KF_TEST_VAR')).toThrow('KF_TEST_VAR');
  });
});
