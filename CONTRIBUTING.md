# Contributing

Use Node.js 22 (see `.nvmrc`) for the checks. The plugins have no dependencies and no build
step: each `.js` file at the repository root is served as it is by GitHub Pages.
Install [Gitleaks](https://github.com/gitleaks/gitleaks#installing) and enable hooks:

```bash
git config --local core.hooksPath .githooks
```

If Gitleaks is not on PATH, set its executable with
`git config --local gitleaks.path /absolute/path/to/gitleaks`.
The pre-commit hook scans staged changes for secrets with the rules in
`.gitleaks.toml`. The commit-msg hook checks the message format. CI also scans
the complete Git history.

## Plugins

- Keep each plugin in one ES5 file at the repository root, wrapped in an IIFE, so it runs in
  the older WebViews of TVs. It must load on its own, without any other plugin of this
  repository.
- Guard against a second load with a `window` flag, register through `Lampa.Listener` or the
  player listener once the app is ready, and fill `Lampa.Manifest.plugins`.
- Expose a small `window.Lampa…` object with the version and a `status()` for the console.
- Bump the plugin's version and the `?v=` of its URL in the README together, so Lampa does not
  keep a cached copy.
- Add tests under `test/` that load the plugin into the fake Lampa from `test/helpers.mjs`.

## Commit messages

Use English [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)
with ASCII punctuation, a lowercase description, and a subject of at most 72
characters. Separate an optional body from the subject with a blank line.

```text
feat: add a plugin that copies a torrent's magnet link
fix: keep the selected episode first in the Infuse playlist
docs: explain how to update a plugin in Lampa
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`, `revert`. An optional scope and breaking-change `!` are supported.
Credit actual human contributions accurately; generated tool signatures are not
required. Pull requests are squash-merged, so give them a title in the same
format (CI checks it); GitHub's own `Revert "..."` titles are accepted too. The
squash commit's body is built from the pull request's commit messages, which CI
checks as well, never from its description.

## Local checks

```bash
node --test
node scripts/check-syntax.mjs
node scripts/check-commit-messages.mjs --rev-range HEAD
git diff --check 4b825dc642cb6eb9a060e54bf8d69288fbee4904 HEAD
gitleaks git --log-opts="--all --full-history" --redact
```

The tests run offline in a fake Lampa and never contact TorrServer, a parser or Infuse.

Keep Jackett and parser API keys, TorrServer passwords, tracker passkeys and logins out of
commits, test fixtures and issue reports. No license has been selected yet; public visibility
alone does not grant permission to reuse the project.
