// =====================================================
// 内置静态服务器 - 用于托管 Chili3D（AGPL-3.0）
// Chili3D 需要 http(s) 源：wasm 通过 fetch 加载，工程数据存 IndexedDB，
// file:// 协议下这两件事都不可靠，因此用本地服务器托管。
// 仅绑定 127.0.0.1，不对外网开放。
// =====================================================
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

// 允许通过 /files/ 暴露给编辑器的模型文件扩展名
const MODEL_EXTENSIONS = new Set(['.step', '.stp', '.iges', '.igs', '.brep', '.stl', '.ply', '.obj']);

function sendFile(res, filePath, contentType) {
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentType || MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size
  });
  fs.createReadStream(filePath).pipe(res);
}

function sendText(res, code, message) {
  res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

/**
 * 启动内置静态服务器
 * @param {object} options
 * @param {string} options.root      Chili3D 构建产物目录
 * @param {string} options.filesDir  可供编辑器打开的模型文件目录
 * @returns {Promise<{server: http.Server, port: number, baseUrl: string}>}
 */
function startStaticServer({ root, filesDir }) {
  const rootDir = path.resolve(root);
  const modelDir = path.resolve(filesDir);

  const server = http.createServer((req, res) => {
    let pathname;
    try {
      // 用 WHATWG URL 解析：自动解码百分号编码，且便于统一做穿越检查
      pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    } catch (e) {
      sendText(res, 400, 'Bad request');
      return;
    }

    if (pathname.startsWith('/files/')) {
      const name = pathname.slice('/files/'.length);
      // 只接受纯文件名，杜绝路径穿越
      if (name !== path.basename(name) || !MODEL_EXTENSIONS.has(path.extname(name).toLowerCase())) {
        sendText(res, 403, 'Forbidden');
        return;
      }
      const filePath = path.join(modelDir, name);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        sendText(res, 404, 'Not found');
        return;
      }
      sendFile(res, filePath, 'application/octet-stream');
      return;
    }

    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }
    const resolved = path.resolve(rootDir, '.' + pathname);
    if (resolved !== rootDir && !resolved.startsWith(rootDir + path.sep)) {
      sendText(res, 403, 'Forbidden');
      return;
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      sendText(res, 404, 'Not found');
      return;
    }
    sendFile(res, resolved);
  });

  return new Promise((resolve, reject) => {
    // 端口 0 表示由系统分配空闲端口，避免与用户已有服务冲突
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port, baseUrl: `http://127.0.0.1:${port}` });
    });
    server.on('error', reject);
  });
}

module.exports = { startStaticServer };
