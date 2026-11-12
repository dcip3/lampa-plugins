// Validates English Conventional Commit messages.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SUBJECT = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\([a-z0-9][a-z0-9._/-]*\))?!?: [a-z][ -~]*$/;
// GitHub's Revert button titles its pull request 'Revert "<subject>"'.
const GITHUB_REVERT = /^Revert ".+"(?: \(#\d+\))?$/;
// A squash merge appends the pull request number to the title.
const PULL_REQUEST_NUMBER = / \(#\d+\)$/;

export function validate(message, comment = '#') {
  const kept = [];
  for (const line of message.split(/\r?\n/)) {
    if (comment !== null) {
      // `git commit -v` puts the staged diff below a scissors line.
      if (new RegExp(`^${comment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} -+ >8 -+$`).test(line)) break;
      if (line.startsWith(comment)) continue;
    }
    kept.push(line);
  }
  const text = kept.join('\n').trim();
  if (!text) return ['Commit message is empty.'];
  const lines = text.split('\n');
  const errors = [];
  if (!GITHUB_REVERT.test(lines[0])) {
    if (!SUBJECT.test(lines[0])) {
      errors.push('Use a Conventional Commit, e.g. fix: keep merged rows sorted by seeders.');
    }
    if (lines[0].replace(PULL_REQUEST_NUMBER, '').length > 72) {
      errors.push('Keep the subject within 72 characters.');
    }
  }
  if ([...text].some((char) => char.charCodeAt(0) > 126 || (char.charCodeAt(0) < 32 && !'\n\t'.includes(char)))) {
    errors.push('Use English text and ASCII punctuation.');
  }
  if (lines.length > 1 && lines[1].trim()) {
    errors.push('Separate the subject and body with a blank line.');
  }
  return errors;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function commentChar() {
  try {
    const value = git(['config', 'core.commentChar']).trim();
    return value.length === 1 ? value : '#';
  } catch {
    return '#';
  }
}

function main(argv) {
  const [flag, value] = argv;
  let messages;
  let comment;
  if (flag === '--file' && value) {
    messages = [[value, readFileSync(value, 'utf8')]];
    comment = commentChar();
  } else if (flag === '--rev-range' && value) {
    // Merge commits carry GitHub's own subjects; the commits they merge are checked.
    const revisions = git(['rev-list', '--no-merges', value]).split('\n').filter(Boolean);
    messages = revisions.map((revision) => [revision.slice(0, 12), git(['show', '-s', '--format=%B', revision])]);
    comment = null;
  } else {
    console.error('Usage: check-commit-messages.mjs --file <path> | --rev-range <range>');
    return 2;
  }
  let failed = false;
  for (const [label, message] of messages) {
    for (const error of validate(message, comment)) {
      console.log(`${label}: ${error}`);
      failed = true;
    }
  }
  if (!failed) console.log(`Validated ${messages.length} commit message(s).`);
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
