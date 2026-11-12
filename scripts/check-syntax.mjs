// Parses every plugin at the repository root and every script and test
// without running them.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const plugins = readdirSync('.').filter((name) => /\.js$/.test(name));
const tooling = ['scripts', 'test'].flatMap((root) =>
  readdirSync(root, { recursive: true })
    .filter((name) => /\.(mjs|js)$/.test(name))
    .map((name) => path.join(root, name)),
);
const files = [...plugins, ...tooling];

let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    failed = true;
  }
}
console.log(`Checked ${files.length} file(s).`);
process.exit(failed ? 1 : 0);
