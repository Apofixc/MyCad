import { spawn } from 'child_process';

// Sets the WebView2 remote debugging port and launches Tauri dev
process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9222';

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

const child = spawn(npmCmd, ['run', 'tauri', 'dev'], {
  stdio: 'inherit',
  env: process.env,
  shell: isWindows,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
