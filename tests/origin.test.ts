import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkOrigin, HttpError } from '../src/lib/http';

function withAppURL(value: string | undefined, run: () => void) {
  const previous = process.env.APP_URL;
  if (value === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = value;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previous;
  }
}

function request(origin?: string, extraHeaders: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: {
      ...(origin !== undefined ? { Origin: origin } : {}),
      ...extraHeaders,
    },
  });
}

function rejected(origin?: string, extraHeaders?: Record<string, string>) {
  assert.throws(
    () => checkOrigin(request(origin, extraHeaders)),
    (error: unknown) => error instanceof HttpError && error.status === 403,
  );
}

test('localhost, IPv4 and IPv6 loopback aliases work with the configured scheme and port', () => {
  const origins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://[::1]:3000',
  ];
  for (const configured of origins) {
    withAppURL(configured, () => {
      for (const origin of origins)
        assert.doesNotThrow(() => checkOrigin(request(origin)));
    });
  }
});

test('loopback aliases cannot change the port or protocol', () => {
  withAppURL('http://localhost:3000', () => {
    for (const origin of [
      'http://127.0.0.1:3001',
      'https://127.0.0.1:3000',
      'http://localhost',
      'http://[::1]:8080',
    ])
      rejected(origin);
  });
});

test('missing, null and malformed origins remain blocked', () => {
  withAppURL('http://localhost:3000', () => {
    for (const origin of [
      undefined,
      '',
      'null',
      'invalid',
      'file:///',
      'http://[invalid',
    ])
      rejected(origin);
  });
});

test('hostname lookalikes and LAN addresses are not trusted as loopback', () => {
  withAppURL('http://localhost:3000', () => {
    for (const origin of [
      'http://localhost.attacker.test:3000',
      'http://127.0.0.1.attacker.test:3000',
      'http://192.168.1.10:3000',
      'https://attacker.test',
    ])
      rejected(origin);
  });
});

test('Origin must be a serialized origin without credentials, path or query', () => {
  withAppURL('http://localhost:3000', () => {
    for (const origin of [
      'http://attacker@localhost:3000',
      'http://localhost:3000/',
      'http://localhost:3000/path',
      'http://localhost:3000?query',
      'http://localhost:3000#fragment',
    ])
      rejected(origin);
  });
});

test('Host and forwarded headers cannot expand the trusted origins', () => {
  withAppURL('https://medito.example', () => {
    rejected('https://attacker.test', {
      Host: 'attacker.test',
      'X-Forwarded-Host': 'attacker.test',
      'X-Forwarded-Proto': 'https',
    });
  });
});

test('public deployment accepts only its configured origin and no loopback aliases', () => {
  withAppURL('https://medito.example', () => {
    assert.doesNotThrow(() => checkOrigin(request('https://medito.example')));
    for (const origin of [
      'http://medito.example',
      'https://medito.example.attacker.test',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ])
      rejected(origin);
  });
});

test('default local configuration also accepts the IPv4 loopback address', () => {
  withAppURL(undefined, () => {
    assert.doesNotThrow(() => checkOrigin(request('http://127.0.0.1:3000')));
  });
});
