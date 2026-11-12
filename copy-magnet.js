(function () {
    'use strict';

    var PLUGIN_ID = 'lampa_copy_magnet';
    var PLUGIN_VERSION = '1.0.0';
    var HEX_HASH = /^[0-9a-f]{40}$/i;
    var BASE32_HASH = /^[a-z2-7]{32}$/i;
    var BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

    var lastOpened = null;
    var copyCount = 0;

    if (window[PLUGIN_ID + '_ready']) return;
    window[PLUGIN_ID + '_ready'] = true;

    var translations = {
        copy_magnet_title: {
            ru: 'Копировать magnet',
            uk: 'Копіювати magnet',
            en: 'Copy magnet'
        },
        copy_magnet_torrent_title: {
            ru: 'Копировать ссылку на .torrent',
            uk: 'Копіювати посилання на .torrent',
            en: 'Copy .torrent link'
        },
        copy_magnet_done: {
            ru: 'Magnet-ссылка скопирована',
            uk: 'Magnet-посилання скопійовано',
            en: 'Magnet link copied'
        },
        copy_magnet_torrent_done: {
            ru: 'Ссылка на .torrent скопирована',
            uk: 'Посилання на .torrent скопійовано',
            en: '.torrent link copied'
        },
        copy_magnet_failed: {
            ru: 'Буфер обмена недоступен, ссылка показана на экране',
            uk: 'Буфер обміну недоступний, посилання показано на екрані',
            en: 'Clipboard is unavailable, the link is shown on screen'
        }
    };

    function t(key) {
        if (window.Lampa && Lampa.Lang && typeof Lampa.Lang.translate === 'function') {
            var value = Lampa.Lang.translate(key);
            if (value && value !== key) return value;
        }

        return translations[key] ? translations[key].en : key;
    }

    function safeDecode(value) {
        try {
            return decodeURIComponent(value);
        } catch (error) {
            return value;
        }
    }

    function cleanText(value) {
        return String(value || '')
            .replace(/<[^>]*>/g, '')
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function isMagnet(value) {
        return /^magnet:\?/i.test(String(value || ''));
    }

    function isHttpLink(value) {
        return /^https?:\/\//i.test(String(value || ''));
    }

    function base32ToHex(value) {
        var bits = '';
        var hex = '';
        var text = String(value).toLowerCase();

        for (var i = 0; i < text.length; i++) {
            var index = BASE32_ALPHABET.indexOf(text.charAt(i));
            if (index < 0) return '';
            bits += ('00000' + index.toString(2)).slice(-5);
        }

        for (var j = 0; j + 4 <= bits.length; j += 4) {
            hex += parseInt(bits.substr(j, 4), 2).toString(16);
        }

        return hex;
    }

    // Returns the info hash as 40 lowercase hex characters, or ''.
    function normalizeHash(value) {
        var text = String(value || '').trim();

        if (HEX_HASH.test(text)) return text.toLowerCase();
        if (BASE32_HASH.test(text)) return base32ToHex(text);

        return '';
    }

    function hashFromMagnet(uri) {
        var match = String(uri || '').match(/[?&]xt=urn:btih:([^&#]+)/i);
        return match ? normalizeHash(safeDecode(match[1])) : '';
    }

    function hashFromStreamUrl(url) {
        var match = String(url || '').match(/[?&]link=([^&#]+)/i);
        return match ? normalizeHash(safeDecode(match[1])) : '';
    }

    function buildMagnet(hash, name) {
        var magnet = 'magnet:?xt=urn:btih:' + hash;
        var title = cleanText(name);

        if (title) magnet += '&dn=' + encodeURIComponent(title);

        return magnet;
    }

    // A parser result: Jackett, LampaParser, TorrServer search and the like.
    // Fields: MagnetUri, Link, InfoHash, Title. Note that Lampa's own
    // `element.hash` is a hash of the title, not the info hash.
    function linkForParserItem(element) {
        if (!element) return null;

        if (isMagnet(element.MagnetUri)) {
            return { kind: 'magnet', text: element.MagnetUri };
        }

        if (isMagnet(element.Link)) {
            return { kind: 'magnet', text: element.Link };
        }

        var hash = normalizeHash(element.InfoHash) || normalizeHash(element.infohash);
        if (hash) {
            return { kind: 'magnet', text: buildMagnet(hash, element.Title || element.title) };
        }

        var link = isHttpLink(element.Link) ? element.Link
            : isHttpLink(element.MagnetUri) ? element.MagnetUri
            : '';

        return link ? { kind: 'torrent', text: link } : null;
    }

    function parserItemHash(element) {
        var link = linkForParserItem(element);
        return link && link.kind === 'magnet' ? hashFromMagnet(link.text) : '';
    }

    // TorrServer puts a multi-file torrent's files under a folder named after
    // the torrent, and names a single-file torrent after its file.
    function torrentNameFromPath(path) {
        var parts = String(path || '').replace(/\\/g, '/').split('/').filter(Boolean);
        return parts.length ? parts[0] : '';
    }

    // A file in the TorrServer file list of an opened torrent.
    function linkForTorrentFile(element) {
        if (!element) return null;

        var hash = normalizeHash(element.torrent_hash) || hashFromStreamUrl(element.url);
        if (!hash) return null;

        // The magnet the parser gave keeps its trackers, so prefer it when the
        // torrent opened from the parser list is the same one.
        if (lastOpened && parserItemHash(lastOpened) === hash) {
            return linkForParserItem(lastOpened);
        }

        return { kind: 'magnet', text: buildMagnet(hash, torrentNameFromPath(element.path)) };
    }

    // A torrent in "My torrents": the TorrServer list entry. `name` is the
    // torrent's own name, `title` the one Lampa gave it when adding.
    function linkForMyTorrent(object) {
        if (!object) return null;

        var hash = normalizeHash(object.hash);
        if (!hash) return null;

        return { kind: 'magnet', text: buildMagnet(hash, object.name || object.title) };
    }

    function restoreController(name) {
        if (!name || !Lampa.Controller || typeof Lampa.Controller.toggle !== 'function') return;

        try {
            Lampa.Controller.toggle(name);
        } catch (error) {
            // The screen the menu was opened from is gone; nothing to return to.
        }
    }

    function showOnScreen(text, controllerName) {
        if (window.console && console.log) console.log('[Copy magnet]', text);

        if (!Lampa.Modal || typeof Lampa.Modal.open !== 'function' || typeof $ !== 'function') {
            restoreController(controllerName);
            return;
        }

        var html = $('<div class="about"></div>');
        html.append($('<div class="selector"></div>')
            .css({ 'word-break': 'break-all', 'user-select': 'text', '-webkit-user-select': 'text' })
            .text(text));

        Lampa.Modal.open({
            title: t('copy_magnet_title'),
            html: html,
            size: 'medium',
            onBack: function () {
                Lampa.Modal.close();
                restoreController(controllerName);
            }
        });
    }

    function copy(link, controllerName) {
        var message = link.kind === 'magnet' ? t('copy_magnet_done') : t('copy_magnet_torrent_done');

        function done() {
            copyCount += 1;
            if (Lampa.Noty) Lampa.Noty.show(message);
            restoreController(controllerName);
        }

        function fail() {
            if (Lampa.Noty) Lampa.Noty.show(t('copy_magnet_failed'));
            showOnScreen(link.text, controllerName);
        }

        function tryAsyncClipboard() {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                navigator.clipboard.writeText(link.text).then(done, fail);
            } else {
                fail();
            }
        }

        if (Lampa.Utils && typeof Lampa.Utils.copyTextToClipboard === 'function') {
            Lampa.Utils.copyTextToClipboard(link.text, done, tryAsyncClipboard);
        } else {
            tryAsyncClipboard();
        }
    }

    function menuItem(link) {
        var controllerName = '';

        if (Lampa.Controller && typeof Lampa.Controller.enabled === 'function') {
            controllerName = (Lampa.Controller.enabled() || {}).name || '';
        }

        return {
            title: link.kind === 'magnet' ? t('copy_magnet_title') : t('copy_magnet_torrent_title'),
            onSelect: function () {
                copy(link, controllerName);
            }
        };
    }

    function addTo(menu, link) {
        if (!link || !Array.isArray(menu)) return;
        menu.push(menuItem(link));
    }

    // Long press on a release in the parser results.
    function onTorrent(event) {
        if (!event) return;

        if (event.type === 'onenter') {
            lastOpened = event.element || null;
        } else if (event.type === 'onlong') {
            addTo(event.menu, linkForParserItem(event.element));
        }
    }

    // Long press on a file of a torrent opened in TorrServer: the "Action" menu.
    function onTorrentFile(event) {
        if (!event || event.type !== 'onlong') return;
        addTo(event.menu, linkForTorrentFile(event.element));
    }

    // Long press on a torrent in "My torrents".
    function onMyTorrents(event) {
        if (!event || event.type !== 'onlong') return;
        addTo(event.menu, linkForMyTorrent(event.object));
    }

    function install() {
        if (!window.Lampa || !Lampa.Listener || typeof Lampa.Listener.follow !== 'function') return;
        if (window[PLUGIN_ID + '_installed']) return;

        window[PLUGIN_ID + '_installed'] = true;

        if (Lampa.Lang && typeof Lampa.Lang.add === 'function') Lampa.Lang.add(translations);

        Lampa.Listener.follow('torrent', onTorrent);
        Lampa.Listener.follow('torrent_file', onTorrentFile);
        Lampa.Listener.follow('mytorrents', onMyTorrents);

        if (Lampa.Manifest) {
            Lampa.Manifest.plugins = {
                type: 'other',
                version: PLUGIN_VERSION,
                name: 'Copy magnet',
                description: 'Copies the magnet link of a torrent from its long-press menu',
                component: PLUGIN_ID
            };
        }
    }

    window.LampaCopyMagnet = {
        version: PLUGIN_VERSION,
        buildMagnet: buildMagnet,
        normalizeHash: normalizeHash,
        linkForParserItem: linkForParserItem,
        linkForTorrentFile: linkForTorrentFile,
        linkForMyTorrent: linkForMyTorrent,
        status: function () {
            return {
                installed: Boolean(window[PLUGIN_ID + '_installed']),
                copies: copyCount,
                lastOpened: lastOpened ? cleanText(lastOpened.Title || lastOpened.title) : ''
            };
        }
    };

    if (window.appready) {
        install();
    } else if (window.Lampa && Lampa.Listener) {
        Lampa.Listener.follow('app', function (event) {
            if (event && event.type === 'ready') install();
        });
    }
})();
