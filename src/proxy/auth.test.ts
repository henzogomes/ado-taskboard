import { describe, it, expect } from 'vitest';
import { buildAuthHeader } from './auth';
describe('buildAuthHeader', () => {
  it('encodes PAT as HTTP Basic with empty username', () => {
    expect(buildAuthHeader('abc')).toBe('Basic ' + Buffer.from(':abc').toString('base64'));
  });

  it('throws a clear error when the PAT is empty', () => {
    expect(() => buildAuthHeader('')).toThrow('No PAT provided — the active connection must carry one.');
  });
});
