// 仅供调试：在浏览器里预览界面  node test/serve.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

http
  .createServer((req, res) => {
    const file = path.normalize(path.join(root, decodeURIComponent(req.url.split('?')[0])));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    fs.readFile(file, (err, buf) => {
      if (err) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': (types[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
      res.end(buf);
    });
  })
  .listen(5178, '127.0.0.1');
