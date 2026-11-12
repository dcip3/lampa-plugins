import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadPlugin } from './helpers.mjs';

const HASH = 'c12fe1c06bba254a9dc9f519b335aa7c1367a88a';
const OTHER = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

function load({ clipboard = true } = {}) {
  const state = { copied: [], noty: [], toggles: [], modal: null };
  const lampa = {
    Lang: {
      strings: {},
      add(strings) { this.strings = strings; },
      translate(key) { return this.strings[key] ? this.strings[key].en : key; },
    },
    Noty: { show: (message) => state.noty.push(message) },
    Utils: {
      copyTextToClipboard: (text, ok, error) => {
        if (!clipboard) return error();
        state.copied.push(text);
        ok();
      },
    },
    Controller: { enabled: () => ({ name: 'torrent_files' }), toggle: (name) => state.toggles.push(name) },
    Modal: { open: (options) => { state.modal = options; }, close() {} },
  };
  const { context, listeners } = loadPlugin('copy-magnet.js', lampa);
  context.$ = (html) => ({
    html,
    children: [],
    append(child) { this.children.push(child); return this; },
    css() { return this; },
    text(value) { this.value = value; return this; },
  });
  return { api: context.LampaCopyMagnet, listeners, state };
}

function longPress(listeners, name, payload) {
  const menu = [];
  listeners[name]({ type: 'onlong', menu, ...payload });
  return menu;
}

test('a parser row copies its own magnet', () => {
  const { listeners, state } = load();
  const MagnetUri = `magnet:?xt=urn:btih:${HASH.toUpperCase()}&dn=Show&tr=udp%3A%2F%2Ftracker`;
  const menu = longPress(listeners, 'torrent', { element: { Title: 'Show', MagnetUri, hash: 'title-hash' } });

  assert.equal(menu.length, 1);
  assert.equal(menu[0].title, 'Copy magnet');
  menu[0].onSelect();
  assert.deepEqual(state.copied, [MagnetUri]);
  assert.deepEqual(state.noty, ['Magnet link copied']);
  assert.deepEqual(state.toggles, ['torrent_files']);
});

test('a row with only an info hash gets a magnet built from it', () => {
  const { listeners, state } = load();
  const element = { Title: 'Film <b>2024</b>  1080p', InfoHash: HASH, Link: 'https://parser/dl/abc' };
  longPress(listeners, 'torrent', { element })[0].onSelect();

  assert.deepEqual(state.copied, [`magnet:?xt=urn:btih:${HASH}&dn=Film%202024%201080p`]);
});

test('a row with only a download link copies the link', () => {
  const { listeners, state } = load();
  const menu = longPress(listeners, 'torrent', { element: { Title: 'x', Link: 'http://jackett/dl/1' } });

  assert.equal(menu[0].title, 'Copy .torrent link');
  menu[0].onSelect();
  assert.deepEqual(state.copied, ['http://jackett/dl/1']);
  assert.deepEqual(state.noty, ['.torrent link copied']);
});

test('a row without any link gets no item', () => {
  const { listeners } = load();
  assert.equal(longPress(listeners, 'torrent', { element: { Title: 'x', hash: 'title-hash' } }).length, 0);
});

test('a file keeps the trackers of the parser magnet it was opened from', () => {
  const { listeners, state } = load();
  const MagnetUri = `magnet:?xt=urn:btih:${HASH}&tr=udp%3A%2F%2Ftracker`;
  listeners.torrent({ type: 'onenter', element: { Title: 'Show', MagnetUri } });

  const element = { torrent_hash: HASH, path: 'Show/e01.mkv', url: `http://ts/stream/e01.mkv?link=${HASH}&index=1` };
  longPress(listeners, 'torrent_file', { element })[0].onSelect();

  assert.deepEqual(state.copied, [MagnetUri]);
});

test('a file of another torrent gets a magnet named after its folder', () => {
  const { listeners, state } = load();
  const element = { url: `http://ts/stream/f.mkv?link=${OTHER}&index=1&play`, path: 'Some Pack [1080p]/Season 1/f.mkv' };
  longPress(listeners, 'torrent_file', { element })[0].onSelect();

  assert.deepEqual(state.copied, [`magnet:?xt=urn:btih:${OTHER}&dn=Some%20Pack%20%5B1080p%5D`]);
});

test('a torrent in My torrents gets a magnet with its name', () => {
  const { listeners, state } = load();
  const object = { hash: OTHER.toUpperCase(), title: 'Film / Original', name: 'Film.2024.1080p' };
  longPress(listeners, 'mytorrents', { object })[0].onSelect();

  assert.deepEqual(state.copied, [`magnet:?xt=urn:btih:${OTHER}&dn=Film.2024.1080p`]);
  assert.equal(longPress(listeners, 'mytorrents', { object: { hash: 'not-a-hash' } }).length, 0);
});

test('a base32 info hash matches the hex hash of TorrServer', () => {
  const { api } = load();
  assert.equal(api.normalizeHash('YEX6DQDLXISUVHOJ6UM3GNNKPQJWPKEK'), HASH);
});

test('without a clipboard the link is shown on screen', () => {
  const { listeners, state } = load({ clipboard: false });
  longPress(listeners, 'torrent_file', { element: { torrent_hash: OTHER, path: 'one.mkv' } })[0].onSelect();

  assert.equal(state.modal.html.children[0].value, `magnet:?xt=urn:btih:${OTHER}&dn=one.mkv`);
  assert.deepEqual(state.noty, ['Clipboard is unavailable, the link is shown on screen']);
  state.modal.onBack();
  assert.deepEqual(state.toggles, ['torrent_files']);
});

test('other events leave the menu alone', () => {
  const { listeners } = load();
  const menu = [];
  listeners.torrent_file({ type: 'render', element: { torrent_hash: HASH }, menu });
  assert.equal(menu.length, 0);
});
