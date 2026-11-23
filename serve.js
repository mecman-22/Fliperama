// Servidor local simples: node serve.js  →  http://localhost:8765
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname, port = +process.env.PORT || 8765;
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm', '.pck': 'application/octet-stream', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.data': 'application/octet-stream'
};
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(port, () => console.log('Fliperama em http://localhost:' + port));
