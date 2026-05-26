const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ignoreDirs = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-electron',
  'dist-renderer',
  'release',
  'out',
]);

const blockedFilePatterns = [
  /\.env$/,
  /\.env\.(?!example$)/,
  /\.jsonl$/,
  /profiles\.json$/,
  /\.db$/,
  /\.sqlite$/,
];

const suspiciousContent = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /ANTHROPIC_AUTH_TOKEN\s*=\s*["']?[^$"'\s]/,
  /DEEPSEEK_API_KEY\s*=\s*(?!replace_me)/,
  /C:\\Users\\[^\\\s]+/i,
  /D:\\ccodex\\(?!ccodex-studio\\?)/i,
];

const findings = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    const rel = path.relative(root, fullPath);

    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) continue;
      if (entry.name === '.claude' || entry.name === '.agents') {
        findings.push(`blocked local data directory: ${rel}`);
        continue;
      }
      walk(fullPath);
      continue;
    }

    if (blockedFilePatterns.some((pattern) => pattern.test(entry.name))) {
      findings.push(`blocked local/sensitive file: ${rel}`);
      continue;
    }

    if (!/\.(ts|tsx|js|json|md|yml|yaml|css|html|example|gitignore)$/i.test(entry.name)) continue;
    if (rel.replace(/\\/g, '/') === 'scripts/prepublish-check.js') continue;
    const text = fs.readFileSync(fullPath, 'utf8');
    for (const pattern of suspiciousContent) {
      if (pattern.test(text)) {
        findings.push(`suspicious content ${pattern}: ${rel}`);
      }
    }
  }
}

walk(root);

if (findings.length) {
  console.error('Prepublish check failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log('Prepublish check passed.');
