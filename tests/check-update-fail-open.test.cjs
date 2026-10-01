'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { cleanup } = require('./helpers.cjs');
const { runNode, OUTCOME } = require('./helpers/process-seam.cjs');

const HOOK = path.join(__dirname, '..', 'hooks', 'gsd-check-update.js');

describe('#4839: update check must not break SessionStart', () => {
  function runHook(t, prelude = '', blockCache = false) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-update-home-'));
    t.after(() => cleanup(home));
    if (blockCache) fs.writeFileSync(path.join(home, '.cache'), 'not a directory');
    const source = [prelude, `require(${JSON.stringify(HOOK)});`].join('\n');
    const env = { ...process.env, HOME: home, USERPROFILE: home };
    const result = runNode(['-e', source], { cwd: home, env });
    assert.equal(result.outcome, OUTCOME.EXITED, result.stderr);
    assert.equal(result.exitCode, 0, result.stderr);
  }

  test('unwritable cache path does not fail the hook', (t) => {
    runHook(t, '', true);
  });

  test('a synchronous worker spawn failure does not fail the hook', (t) => {
    runHook(t, [
      "require('node:child_process').spawn = () => {",
      "  throw new Error('spawn unavailable');",
      '};',
    ].join('\n'));
  });

  test('an asynchronous worker error does not fail the hook', (t) => {
    runHook(t, [
      "const { EventEmitter } = require('node:events');",
      "require('node:child_process').spawn = () => {",
      '  const child = new EventEmitter();',
      '  child.unref = () => {};',
      "  process.nextTick(() => child.emit('error', new Error('spawn ENOENT')));",
      '  return child;',
      '};',
    ].join('\n'));
  });
});
