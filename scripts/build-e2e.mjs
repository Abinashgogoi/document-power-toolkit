import { spawn } from 'node:child_process';

const npmCli = process.env.npm_execpath;

if (!npmCli) {
  throw new Error('npm CLI path is unavailable. Run this script through npm.');
}

const child = spawn(process.execPath, [npmCli, 'run', 'build'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_E2E_BYPASS: '1',
  },
});

child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
