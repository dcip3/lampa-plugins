import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadPlugin } from './helpers.mjs';

const HASH = 'c12fe1c06bba254a9dc9f519b335aa7c1367a88a';

function stream(index) {
  return `http://192.168.1.7:8090/stream/Show.S01E${String(index).padStart(2, '0')}.mkv?link=${HASH}&index=${index}&preload`;
}

function load() {
  let handler;
  const { context } = loadPlugin('infuse-fix.js', {
    Player: { listener: { follow: (name, fn) => { if (name === 'infuse_build_url') handler = fn; } } },
  });
  return { api: context.LampaInfuseTorrServerFix, launch: (event) => handler(event) };
}

function urls(link) {
  return [...link.matchAll(/[?&]url=([^&]*)/g)].map((match) => decodeURIComponent(match[1]));
}

test('the selected episode comes first, followed only by later ones', () => {
  const { api } = load();
  const playlist = Array.from({ length: 90 }, (_, i) => ({ url: stream(i + 1), path: `Show/Show.S01E${i + 1}.mkv` }));
  const link = api.buildInfuseUrl({ url: stream(85), playlist });
  const sent = urls(link);

  assert.equal(sent.length, 6);
  assert.match(sent[0], /index=85&play$/);
  assert.match(sent.at(-1), /index=90&play$/);
  assert.ok(link.startsWith('infuse://x-callback-url/play?'));
});

test('the playlist stops at 40 items', () => {
  const { api } = load();
  const playlist = Array.from({ length: 90 }, (_, i) => ({ url: stream(i + 1) }));
  const sent = urls(api.buildInfuseUrl({ url: stream(1), playlist }));

  assert.equal(sent.length, 40);
  assert.match(sent[39], /index=40&play$/);
});

test('only TorrServer streams are rewritten', () => {
  const { api, launch } = load();
  const rewritten = [];
  const event = (data) => ({ data, callbacks: {}, setUrl: (url) => rewritten.push(url) });

  launch(event({ url: 'https://cdn.example/video.m3u8' }));
  launch(event({ url: stream(3), torrent_hash: HASH }));

  assert.equal(rewritten.length, 1);
  assert.equal(api.status().interceptions, 1);
});
