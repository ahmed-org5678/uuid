import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import v3 from '../v3.js';
import v5 from '../v5.js';
import validate from '../validate.js';
import version from '../version.js';

const executable = fileURLToPath(new URL('../bin/uuid', import.meta.url));

function run(...args: string[]) {
  const result = spawnSync(process.execPath, [executable, ...args], {
    encoding: 'utf8',
    timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

function checkUUIDs(args: string[], count: number, expectedVersion: number) {
  const result = run(...args);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.ok(result.stdout.endsWith('\n'));
  const ids = result.stdout.slice(0, -1).split('\n');
  assert.equal(ids.length, count);
  for (const id of ids) {
    assert.ok(validate(id), id);
    assert.equal(version(id), expectedVersion);
  }
  return ids;
}

function checkError(args: string[]) {
  const result = run(...args);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.ok(result.stderr.endsWith('\n'));
  assert.equal(result.stderr.slice(0, -1).split('\n').length, 1);
  return result.stderr;
}

describe('uuid CLI', () => {
  test('defaults to one v4 UUID', () => {
    checkUUIDs([], 1, 4);
  });

  for (const expectedVersion of [1, 4, 6, 7]) {
    const requestedVersion = `v${expectedVersion}`;

    test(`${requestedVersion} defaults to one UUID`, () => {
      checkUUIDs([requestedVersion], 1, expectedVersion);
    });

    for (const option of ['--count', '-n']) {
      for (const before of [true, false]) {
        test(`${requestedVersion} accepts ${option} ${before ? 'before' : 'after'} the version`, () => {
          const args = before
            ? [option, '3', requestedVersion]
            : [requestedVersion, option, '3'];
          checkUUIDs(args, 3, expectedVersion);
        });
      }
    }

    for (const count of [1, 10000]) {
      test(`${requestedVersion} accepts the boundary count ${count}`, () => {
        const ids = checkUUIDs(
          [requestedVersion, '--count', String(count)],
          count,
          expectedVersion,
        );
        if (expectedVersion === 7) {
          for (let i = 1; i < ids.length; i++) {
            assert.ok(ids[i - 1] < ids[i], `${ids[i - 1]} < ${ids[i]}`);
          }
        }
      });
    }
  }

  for (const option of ['--count', '-n']) {
    test(`${option} uses v4 when the version is omitted`, () => {
      checkUUIDs([option, '3'], 3, 4);
    });

    for (const value of [
      '0',
      '-1',
      '1.5',
      'abc',
      '',
      '10001',
      '999999999999999999999999',
      'NaN',
      'Infinity',
      '3abc',
      '1e2',
      '0x10',
      ' ',
      '2\n3',
    ]) {
      for (const before of [true, false]) {
        test(`rejects ${option} ${JSON.stringify(value)} ${before ? 'before' : 'after'} the version`, () => {
          const args = before ? [option, value, 'v7'] : ['v7', option, value];
          const stderr = checkError(args);
          assert.ok(stderr.includes(JSON.stringify(value)), stderr);
          assert.match(stderr, /whole number from 1 to 10000/);
        });
      }
    }

    for (const args of [[option], ['v7', option]]) {
      test(`rejects missing value in ${args.join(' ')}`, () => {
        assert.match(checkError(args), /count.*missing/i);
      });
    }

    test(`rejects a version used as the value of ${option}`, () => {
      assert.match(checkError([option, 'v7']), /"v7"/);
    });

    for (const requestedVersion of ['v3', 'v5']) {
      for (const before of [true, false]) {
        test(`rejects ${option} for ${requestedVersion} ${before ? 'before' : 'after'} the version`, () => {
          const args = before
            ? [option, '1', requestedVersion, 'example.com', 'DNS']
            : [requestedVersion, option, '1', 'example.com', 'DNS'];
          const stderr = checkError(args);
          assert.match(stderr, /count.*not supported/i);
          assert.ok(stderr.includes(requestedVersion), stderr);
        });
      }
    }
  }

  for (const [requestedVersion, generate] of [
    ['v3', v3],
    ['v5', v5],
  ] as const) {
    for (const namespace of ['DNS', 'URL', v3.DNS]) {
      test(`${requestedVersion} preserves single output with namespace ${namespace}`, () => {
        const result = run(requestedVersion, 'example.com', namespace);
        const namespaceUUID =
          namespace === 'DNS'
            ? generate.DNS
            : namespace === 'URL'
              ? generate.URL
              : namespace;
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.stderr, '');
        assert.equal(
          result.stdout,
          `${generate('example.com', namespaceUUID)}\n`,
        );
      });
    }

    for (const args of [
      [requestedVersion],
      [requestedVersion, 'example.com'],
    ]) {
      test(`preserves missing name or namespace error for ${args.join(' ')}`, () => {
        const result = run(...args);
        assert.equal(result.status, 1);
        assert.equal(result.stdout, '');
        assert.match(result.stderr, /not specified/);
      });
    }
  }

  test('help describes count aliases, range and placement', () => {
    const result = run('--help');
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /Usage:/);
    assert.match(
      result.stdout,
      /--count <n>.*-n <n>.*1 to 10000.*v1.*v4.*v6.*v7/,
    );
    assert.match(result.stdout, /before or after the version/);
  });

  test('an unknown version still prints usage and exits 1', () => {
    const result = run('v8');
    assert.equal(result.status, 1);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /Usage:/);
  });
});
