const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Resolve the pre-installed Chromium without hardcoding a version number,
// falling back to Playwright's own default resolution if the env var isn't set.
function findChromeExecutable() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !fs.existsSync(base)) return undefined;
  const dir = fs.readdirSync(base).find((d) => d.startsWith('chromium-') && !d.includes('headless'));
  if (!dir) return undefined;
  const exe = path.join(base, dir, 'chrome-linux', 'chrome');
  return fs.existsSync(exe) ? exe : undefined;
}

async function launch() {
  const executablePath = findChromeExecutable();
  return chromium.launch({ executablePath, args: ['--no-sandbox'] });
}

module.exports = { launch };
