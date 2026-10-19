// SPDX-License-Identifier: MPL-2.0
// Defense against accidental Node network I/O during local verification.
// This is NOT an OS sandbox and does not constrain arbitrary native binaries.
'use strict';
const net = require('node:net');
const dns = require('node:dns');
const dgram = require('node:dgram');

function denied() {
  const error = new Error('Offline verification blocks non-loopback network I/O.');
  error.code = 'OFFLINE_NETWORK_DENIED';
  return error;
}
function loopback(host) {
  if (typeof host !== 'string') return false;
  const value = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (value === 'localhost' || value === '::1') return true;
  const parts = value.split('.');
  return parts.length === 4 && parts[0] === '127' && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (first && typeof first === 'object') {
    if (typeof first.path === 'string') return connect.apply(this, args); // local IPC
    if (!loopback(first.host ?? first.hostname ?? 'localhost')) throw denied();
  } else if (typeof first === 'number' || (typeof first === 'string' && /^\d+$/.test(first))) {
    if (!loopback(typeof args[1] === 'string' ? args[1] : 'localhost')) throw denied();
  } else if (typeof first !== 'string') {
    throw denied();
  }
  return connect.apply(this, args);
};

const originalFetch = globalThis.fetch;
if (originalFetch) globalThis.fetch = function (input, init) {
  try {
    const url = new URL(input instanceof URL ? input.href : typeof input === 'string' ? input : input.url);
    if (!['data:', 'blob:'].includes(url.protocol) && (!['http:', 'https:'].includes(url.protocol) || !loopback(url.hostname))) throw denied();
  } catch (error) { return Promise.reject(error); }
  return originalFetch.call(this, input, init);
};

for (const [api, promise] of [[dns, false], [dns.promises, true]]) {
  const lookup = api.lookup;
  api.lookup = function (hostname, ...args) {
    if (!loopback(hostname)) {
      if (promise) return Promise.reject(denied());
      throw denied();
    }
    // Never ask a resolver to establish what a loopback spelling means.
    const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const literal = normalized === 'localhost' ? '127.0.0.1' : normalized === '::1' ? normalized : normalized.split('.').map(Number).join('.');
    return lookup.call(this, literal, ...args);
  };
  for (const target of [api, api.Resolver?.prototype].filter(Boolean)) {
    for (const name of Object.getOwnPropertyNames(target)) {
      if ((name.startsWith('resolve') || name === 'reverse' || name === 'lookupService') && typeof target[name] === 'function') {
        target[name] = promise ? async function () { throw denied(); } : function () { throw denied(); };
      }
    }
  }
}
for (const name of ['send', 'connect']) dgram.Socket.prototype[name] = function () { throw denied(); };
