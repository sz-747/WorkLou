import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// These suites share fixtures. A parallel test matrix races on the same rows.
const { scripts } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const suites = Object.keys(scripts).filter(name => name === 'db:test' || name.startsWith('db:test:'));
for (const suite of suites) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', suite], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error || result.status !== 0) {
    console.error(`Database suite failed: ${suite}`);
    process.exit(result.status || 1);
  }
}
