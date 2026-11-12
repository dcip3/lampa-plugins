// Loads a plugin into a fresh context with a minimal fake of Lampa, the way
// Lampa runs it: as a classic script after the app is ready.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function loadPlugin(file, lampa = {}) {
  const listeners = {};
  const context = { console, navigator: {}, appready: true };
  context.window = context;
  context.Lampa = {
    Listener: { follow: (name, handler) => { listeners[name] = handler; } },
    Manifest: {},
    ...lampa,
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context, { filename: file });
  return { context, listeners };
}
