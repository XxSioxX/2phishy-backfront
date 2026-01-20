const { execSync } = require('child_process');
const isWindows = process.platform === 'win32';

try {
  if (isWindows) {
    // On Windows run the PowerShell script
    execSync('powershell -ExecutionPolicy Bypass -File scripts/backend_start.ps1', { stdio: 'inherit' });
  } else {
    // On WSL/Linux/macOS run the sh
    execSync('sh scripts/backend_start.sh', { stdio: 'inherit' });
  }
} catch (err) {
  console.error('Backend failed to start:', err.message);
  process.exit(1);
}
