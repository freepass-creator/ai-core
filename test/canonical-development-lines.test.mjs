import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCanonicalDevelopmentLines } from '../scripts/validate-canonical-development-lines.mjs';

test('canonical development lines have one declared authority and legacy docs are demoted', async () => {
  const errors = await validateCanonicalDevelopmentLines();
  assert.deepEqual(errors, []);
});
