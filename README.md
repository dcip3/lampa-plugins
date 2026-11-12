# Lampa Plugins

Small, dependency-free plugins for [Lampa](https://github.com/yumata/lampa-source). Each one is a
single file that loads on its own, so install only the ones you need.

| Plugin | What it does | URL |
| --- | --- | --- |
| [Infuse Fix](#infuse-fix) | Opens the selected TorrServer episode in Infuse, even far down a large pack | `https://dcip3.github.io/lampa-plugins/infuse-fix.js?v=1.1.0` |
| [Copy magnet](#copy-magnet) | Copies a torrent's magnet link from its long-press menu | `https://dcip3.github.io/lampa-plugins/copy-magnet.js?v=1.0.0` |

## Installation

1. Open **Lampa → Settings → Extensions → Add plugin**.
2. Enter the plugin's URL from the table above.
3. Fully restart Lampa.

To update a plugin, replace its URL with the one in the table, whose `?v=` changes with every
release, and restart Lampa. The same URL without a new `?v=` may keep a cached copy for a while.

The plugins were published from `dcip3.github.io/lampa-infuse-fix/` before. That address no
longer serves them: replace an old URL with the one above.

### Local testing

Serve a checkout of this repository:

```sh
python3 -m http.server 8765 --directory /path/to/lampa-plugins
```

Then add `http://localhost:8765/infuse-fix.js` or `http://localhost:8765/copy-magnet.js` in a
Lampa that runs on the same computer. If the browser blocks an HTTP plugin loaded by
`https://lampa.mx`, use the GitHub Pages URL or another HTTPS host.

## Infuse Fix

`infuse-fix.js` fixes the episode Infuse opens from a large TorrServer torrent pack.

When an episode is selected, the plugin sends that episode first, followed by up to 39 subsequent
files from the torrent. Infuse opens the requested episode and can continue forward without
wrapping back to the beginning of the torrent. Regular URLs, other external players, and Lampa's
built-in player are not modified.

### Usage

1. Select **Infuse** as the external player for torrents or TV episodes.
2. Open a torrent pack through TorrServer.
3. Select any episode, including one far down the list.
4. Infuse should open that exact episode.

For example, a selected TorrServer stream containing `index=85` becomes the first item in an
Infuse request similar to:

```text
infuse://x-callback-url/play?url=...%26index%3D85%26play&filename=...S09E04.mkv&url=...%26index%3D86%26play&filename=...S09E05.mkv&...
```

### Root cause

As reviewed on August 17, 2026, Lampa's `src/core/infusePlayer.js` performs these steps:

1. Finds the selected episode and records its `startIndex`.
2. Builds links from the beginning of the source playlist, stopping at `maxItems: 40`.
3. Attempts to rotate the truncated list using the original `startIndex`.

If the selected episode is at position 40 or later, it is already absent from the truncated list.
The rotation is skipped because the original index is outside the new list, leaving the first
torrent episode at the front.

### How it works

The plugin subscribes to Lampa's supported `infuse_build_url` extension event. Immediately before
Infuse launches, it checks whether the selected stream is a TorrServer URL, finds that URL in the
original playlist, and builds a forward-only temporary playlist:

1. The selected item is placed first.
2. Up to 39 subsequent items are appended in their original order.
3. Items before the selection are never appended, so playback cannot wrap to the first season.
4. The list is shortened further if the deep link approaches 65,536 characters.

When available, the request also preserves:

- The episode filename for Infuse metadata matching
- The playback resume position
- The first external subtitle track
- Lampa's `x-success` and `x-error` callbacks

Non-TorrServer streams are ignored.

Earlier episodes are intentionally omitted. Infuse's URL API plays entries sequentially and does
not provide a documented start-index parameter, so including earlier episodes while preserving
chronological order would cause Infuse to start the wrong item.

### Relationship to `infuseSave.js`

`https://lampame.github.io/main/infuseSave.js` is only a loader for
`https://lampame.github.io/main/its/its.js`, the AppleTV Tweaks / Infuse Saver plugin. It adds
torrent-file menu actions to save one file, save all files, or edit the selection before saving.
It does not intercept `infuse_build_url` and does not fix normal playback of an episode selected
from a large torrent pack. Both plugins can be installed at the same time.

### Diagnostics

In the Lampa developer console:

```js
LampaInfuseTorrServerFix.version   // '1.1.0'
LampaInfuseTorrServerFix.status()  // { installed: true, interceptions: 1, lastPlaylistSize: 40 }
```

`interceptions` grows with every TorrServer launch through Infuse. The URL generator can also be
checked without launching Infuse:

```js
LampaInfuseTorrServerFix.buildInfuseUrl({
  url: 'http://192.168.1.7:8090/stream/Rick.and.Morty.S09E04.mkv?link=HASH&index=85&play'
})
```

The plugin requires a Lampa version that provides the `infuse_build_url` event.

## Copy magnet

`copy-magnet.js` adds a **Copy magnet** item to three long-press menus:

| Where | Source of the link |
| --- | --- |
| A file of a torrent opened through TorrServer (the **Action** menu) | The parser's magnet when the torrent was opened from the parser list, so its trackers are kept; otherwise a magnet built from the TorrServer info hash, named after the torrent's folder |
| A release in the parser results | `MagnetUri`, a magnet in `Link`, or a magnet built from `InfoHash` ([LampaParser](https://github.com/dcip3/DCIP3.LampaParser) sends it for rows that keep a `/dl/` link) |
| A torrent in **My torrents** | A magnet built from its info hash and name |

A release with only a `.torrent` download link gets **Copy .torrent link** instead. That link is
the parser's own and may carry its API key or a tracker passkey, so keep it private.

When the clipboard is unavailable, as it may be on a TV, the link is shown on screen and written
to the console.

### Diagnostics

```js
LampaCopyMagnet.version   // '1.0.0'
LampaCopyMagnet.status()  // { installed: true, copies: 1, lastOpened: 'Release title' }
```

## References

- [Lampa Infuse integration](https://github.com/yumata/lampa-source/blob/main/src/core/infusePlayer.js)
- [Lampa player extension hook](https://github.com/yumata/lampa-source/blob/main/src/interaction/player.js)
- [Lampa torrent file menu](https://github.com/yumata/lampa-source/blob/main/src/interaction/torrent.js)
- [`infuseSave.js` loader](https://github.com/lampame/main/blob/main/infuseSave.js)
- [Infuse Saver / AppleTV Tweaks implementation](https://github.com/lampame/main/blob/main/its/its.js)
- [Firecore x-callback-url API](https://support.firecore.com/hc/en-us/articles/215090997-API-for-Third-Party-Apps-Services)

Contributions follow [CONTRIBUTING.md](CONTRIBUTING.md); report security problems as described in
[SECURITY.md](SECURITY.md).
