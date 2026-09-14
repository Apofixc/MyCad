import { spawn, spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcTauriDir = path.resolve(__dirname, '..', 'src-tauri');

// Automatically clean old application build artifacts before launching
try {
  const cargoCmd = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
  spawnSync(cargoCmd, ['clean', '-p', 'mycad'], { cwd: srcTauriDir, stdio: 'ignore' });
} catch {
  // ignore if cargo is not found
}

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
