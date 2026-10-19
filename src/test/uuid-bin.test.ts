import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import v3 from '../v3.js';
import v5 from '../v5.js';
import validate from '../validate.js';
import version from '../version.js';

function run(...args: string[]) {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('../uuid-bin.js', import.meta.url)), ...args],
    { encoding: 'utf8', timeout: 10000 },
  );
  assert.ifError(result.error);
  return result;
}

function batch(args: string[], count: number, expectedVersion: number) {
  const result = run(...args);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(result.stderr, '');
  assert.ok(result.stdout.endsWith('\n'));
  const ids = result.stdout.trimEnd().split('\n');
  assert.strictEqual(ids.length, count);
  for (const id of ids) {
    assert.ok(validate(id), id);
    assert.strictEqual(version(id), expectedVersion);
  }
  return ids;
}

describe('uuid CLI', () => {
  test('defaults to one v4 UUID', () => {
    batch([], 1, 4);
  });

  for (const number of [1, 4, 6, 7]) {
    const selected = `v${number}`;
    test(`${selected} defaults to one UUID`, () => {
      batch([selected], 1, number);
    });

    for (const option of ['--count', '-n']) {
      for (const before of [true, false]) {
        test(`${selected} accepts ${option} ${before ? 'before' : 'after'} the version`, () => {
          batch(
            before ? [option, '3', selected] : [selected, option, '3'],
            3,
            number,
          );
        });
      }
    }

    for (const count of [1, 10000]) {
      test(`${selected} accepts count ${count}`, () => {
        const ids = batch([selected, '--count', String(count)], count, number);
        if (number === 7) {
          for (let i = 1; i < ids.length; i++) {
            assert.ok(ids[i - 1] < ids[i], `${ids[i - 1]} < ${ids[i]}`);
          }
        }
      });
    }
  }

  for (const option of ['--count', '-n']) {
    test(`${option} without a version generates v4 UUIDs`, () => {
      batch([option, '3'], 3, 4);
    });

    for (const value of [
      '0',
      '-1',
      '1.5',
      'NaN',
      'Infinity',
      'abc',
      '10001',
      '1e3',
      '0x10',
      '',
      ' ',
      ' 3',
      '3 ',
      '+3',
      '3abc',
      '3\n',
      undefined,
    ]) {
      for (const before of [true, false]) {
        test(`${option} rejects ${JSON.stringify(value)} ${before ? 'before' : 'after'} the version`, () => {
          const countArgs = value === undefined ? [option] : [option, value];
          const result = run(
            ...(before ? [...countArgs, 'v4'] : ['v4', ...countArgs]),
          );
          assert.strictEqual(result.status, 1);
          assert.strictEqual(result.stdout, '');
          assert.strictEqual(result.stderr.trimEnd().split('\n').length, 1);
          assert.ok(result.stderr.includes('whole number from 1 to 10000'));
          assert.ok(
            result.stderr.includes(
              value === undefined
                ? before
                  ? '"v4"'
                  : '<missing>'
                : JSON.stringify(value),
            ),
          );
        });
      }
    }

    for (const selected of ['v3', 'v5']) {
      for (const before of [true, false]) {
        test(`${selected} refuses ${option} ${before ? 'before' : 'after'} the version`, () => {
          const positional = [selected, 'example.com', 'DNS'];
          const result = run(
            ...(before
              ? [option, '1', ...positional]
              : [...positional, option, '1']),
          );
          assert.strictEqual(result.status, 1);
          assert.strictEqual(result.stdout, '');
          assert.match(
            result.stderr,
            new RegExp(`not supported for ${selected}.*deterministic`),
          );
          assert.strictEqual(result.stderr.trimEnd().split('\n').length, 1);
        });
      }
    }
  }

  for (const [selected, generate] of [
    ['v3', v3],
    ['v5', v5],
  ] as const) {
    test(`${selected} retains deterministic defaults and namespace aliases`, () => {
      for (const namespace of ['DNS', 'URL', v3.DNS]) {
        const result = run(selected, 'example.com', namespace);
        assert.strictEqual(result.status, 0, result.stderr);
        assert.strictEqual(result.stderr, '');
        const resolved =
          namespace === 'DNS'
            ? generate.DNS
            : namespace === 'URL'
              ? generate.URL
              : namespace;
        assert.strictEqual(
          result.stdout,
          `${generate('example.com', resolved)}\n`,
        );
      }
    });
  }

  test('help describes aliases, range, defaults, positions and version restrictions', () => {
    const result = run('--help');
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stderr, '');
    for (const text of [
      'Usage:',
      '--count <n> | -n <n>',
      '1 to 10000',
      'default: 1',
      'before or after the version',
      'not supported for v3 or v5',
      'v7 batches are strictly increasing',
    ]) {
      assert.ok(result.stdout.includes(text), text);
    }
    for (const selected of ['v1', 'v4', 'v6', 'v7']) {
      assert.ok(
        result.stdout.includes(`uuid ${selected} [--count <n> | -n <n>]`),
      );
    }
  });
});
