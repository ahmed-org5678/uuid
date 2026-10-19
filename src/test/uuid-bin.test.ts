import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/uuid', import.meta.url));

function runCli(args: string[]) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: 'utf8',
    timeout: 5000,
  });
  assert.ifError(result.error);
  assert.strictEqual(result.signal, null);
  assert.strictEqual(result.stderr, '');
  return result;
}

describe('uuid CLI', () => {
  test('both help flags print the same usage and exit successfully', () => {
    const longHelp = runCli(['--help']);
    const shortHelp = runCli(['-h']);

    assert.strictEqual(longHelp.status, 0);
    assert.strictEqual(shortHelp.status, 0);
    assert.strictEqual(shortHelp.stdout, longHelp.stdout);
    assert.match(longHelp.stdout, /^Usage:\n/);
    assert.ok(longHelp.stdout.includes('  uuid --help\n  uuid -h\n'));
  });

  test('both help flags take precedence at every argument position', () => {
    const usage = runCli(['--help']).stdout;

    for (const args of [
      ['v4'],
      ['v3'],
      ['v5', 'example', 'DNS'],
      ['unknown-version'],
    ]) {
      for (let position = 0; position <= args.length; position++) {
        for (const flag of ['--help', '-h']) {
          const helpArgs = [
            ...args.slice(0, position),
            flag,
            ...args.slice(position),
          ];
          const result = runCli(helpArgs);

          assert.strictEqual(result.status, 0, JSON.stringify(helpArgs));
          assert.strictEqual(result.stdout, usage, JSON.stringify(helpArgs));
        }
      }
    }
  });

  test('an unknown version still prints usage and exits with status 1', () => {
    const result = runCli(['unknown-version']);

    assert.strictEqual(result.status, 1);
    assert.strictEqual(result.stdout, runCli(['--help']).stdout);
  });
});
