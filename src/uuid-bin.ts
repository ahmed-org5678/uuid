import * as assert from 'node:assert/strict';

import v1 from './v1.js';
import v3 from './v3.js';
import v4 from './v4.js';
import v5 from './v5.js';
import v6 from './v6.js';
import v7 from './v7.js';

function usage() {
  console.log('Usage:');
  console.log('  uuid');
  console.log('  uuid v1');
  console.log('  uuid v3 <name> <namespace uuid>');
  console.log('  uuid v4');
  console.log('  uuid v5 <name> <namespace uuid>');
  console.log('  uuid v6');
  console.log('  uuid v7');
  console.log('  uuid --help');
  console.log(
    '\nOptions: --count <n> or -n <n> prints 1 to 10000 UUIDs for v1, v4, v6 or v7.',
  );
  console.log('  The count option may appear before or after the version.');
  console.log(
    '\nNote: <namespace uuid> may be "URL" or "DNS" to use the corresponding UUIDs defined by RFC9562',
  );
}

const args = process.argv.slice(2);

if (args.indexOf('--help') >= 0) {
  usage();
  process.exit(0);
}

let count = 1;
let hasCount = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] !== '--count' && args[i] !== '-n') continue;

  const value = args[i + 1];
  if (
    value === undefined ||
    !/^\d+$/.test(value) ||
    Number(value) < 1 ||
    Number(value) > 10000
  ) {
    console.error(
      `Invalid count ${JSON.stringify(value ?? '<missing>')}: expected a whole number from 1 to 10000`,
    );
    process.exit(1);
  }

  count = Number(value);
  hasCount = true;
  args.splice(i, 2);
  i--;
}

const version = args.shift() || 'v4';

if (hasCount && (version === 'v3' || version === 'v5')) {
  console.error(`Count is not supported for ${version}`);
  process.exit(1);
}

switch (version) {
  case 'v1':
  case 'v4':
  case 'v6':
  case 'v7': {
    const generate: () => string = { v1, v4, v6, v7 }[version];
    for (let i = 0; i < count; i++) {
      console.log(generate());
    }
    break;
  }

  case 'v3': {
    const name = args.shift();
    let namespace = args.shift();

    assert.ok(name != null, 'v3 name not specified');
    assert.ok(namespace != null, 'v3 namespace not specified');

    if (namespace === 'URL') {
      namespace = v3.URL;
    }

    if (namespace === 'DNS') {
      namespace = v3.DNS;
    }

    console.log(v3(name, namespace));
    break;
  }

  case 'v5': {
    const name = args.shift();
    let namespace = args.shift();

    assert.ok(name != null, 'v5 name not specified');
    assert.ok(namespace != null, 'v5 namespace not specified');

    if (namespace === 'URL') {
      namespace = v5.URL;
    }

    if (namespace === 'DNS') {
      namespace = v5.DNS;
    }

    console.log(v5(name, namespace));
    break;
  }

  default:
    usage();
    process.exit(1);
}
