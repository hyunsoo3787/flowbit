// Development server: recompiles on change (tsc --watch) and restarts the
// API whenever the compiled output changes (node --watch).
import { spawn } from 'node:child_process';

const tsc = spawn(
  'pnpm',
  ['exec', 'tsc', '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'],
  {
    stdio: ['ignore', 'pipe', 'inherit'],
  },
);

let server;
tsc.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (!server && /Found 0 errors/.test(chunk.toString())) {
    server = spawn(
      'node',
      [
        '--env-file-if-exists=.env',
        '--enable-source-maps',
        '--watch-path=dist',
        'dist/src/main.js',
      ],
      { stdio: 'inherit' },
    );
    server.on('exit', (code) => process.exit(code ?? 0));
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server?.kill(signal);
    tsc.kill(signal);
    process.exit(0);
  });
}
