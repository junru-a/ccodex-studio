const fs = require('fs');
const http = require('http');
const path = require('path');
const webpack = require('webpack');
const createConfig = require('../webpack.renderer.config');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'dist-renderer');
const port = Number(process.env.PORT || 9000);
const config = createConfig({}, { mode: 'development' });

delete config.devServer;
config.watch = true;

const compiler = webpack(config);

compiler.watch({}, (err, stats) => {
  if (err) {
    console.error(err);
    return;
  }
  if (!stats) return;
  const info = stats.toString({
    colors: true,
    chunks: false,
    modules: false,
    children: false,
  });
  console.log(info);
});

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.map') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  return 'application/octet-stream';
}

function safeResolve(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const requested = decoded === '/' ? '/index.html' : decoded;
  const target = path.resolve(outputDir, `.${requested}`);
  const relative = path.relative(outputDir, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return target;
}

const server = http.createServer((req, res) => {
  const target = safeResolve(req.url || '/');
  const fallback = path.join(outputDir, 'index.html');
  const filePath = target && fs.existsSync(target) ? target : fallback;

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    res.end(content);
  });
});

server.listen(port, () => {
  console.log(`[dev-renderer] http://localhost:${port}`);
});
