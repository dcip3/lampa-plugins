import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validate } from '../scripts/check-commit-messages.mjs';

test('conventional English subjects pass', () => {
  assert.deepEqual(validate('feat: merge duplicate torrents'), []);
  assert.deepEqual(validate('fix(resolver)!: skip passkeys in magnets\n\nLonger body.'), []);
  assert.deepEqual(validate('Revert "feat: merge duplicate torrents" (#12)'), []);
  assert.deepEqual(validate('feat: add a thing\n\n# a comment line\n'), []);
});

test('malformed messages are rejected', () => {
  assert.equal(validate('Added stuff').length, 1);
  assert.equal(validate('feat: Uppercase description').length, 1);
  assert.equal(validate(`feat: ${'x'.repeat(80)}`).length, 1);
  assert.equal(validate('feat: добавить фильтр').length, 2);
  assert.equal(validate('feat: subject\nbody without blank line').length, 1);
  assert.deepEqual(validate('# only a comment\n'), ['Commit message is empty.']);
});
