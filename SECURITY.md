# Security

Report suspected vulnerabilities privately through the repository's Security tab
(Report a vulnerability) or to keypoints.motion@gmail.com. Include
the affected plugin and version, reproduction steps, and impact. Do not include live API
keys, tracker logins, or passkeys in a public issue.

Use the latest version on `main`; older revisions do not receive security fixes.

## Using the plugins

- Lampa runs a plugin with full access to its settings, including parser and TorrServer
  addresses and keys. Load these plugins only from `https://dcip3.github.io/`, the address
  GitHub Pages serves this repository from.
- The plugins send nothing anywhere. Infuse Fix builds an `infuse://` link from the stream
  Lampa already has; Copy magnet writes a link to the clipboard or shows it on screen.
- A copied `.torrent` link is the parser's own download link and may contain its API key or
  a tracker passkey. Treat it as private and do not paste it into public chats.
- Run the secret checks described in `CONTRIBUTING.md` before publishing changes.
  Automated scans reduce risk but cannot prove no secret exists.

If a credential is committed, revoke or rotate it first. Removing a file or
rewriting Git history does not invalidate an exposed credential. Follow
[GitHub's sensitive-data removal guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
for history, cached references, forks, and other clones.
