// =====================================================
// 同步 Chili3D 构建产物到 vendor/chili3d
//
// Chili3D (https://github.com/xiangechen/chili3d) 采用 AGPL-3.0，
// 本项目因包含其代码/构建产物，整体同样以 AGPL-3.0 发布。
// 详见 vendor/chili3d/NOTICE.md
//
// 用法：node scripts/sync-chili3d.mjs [chili3d目录]
//   默认从 ../chili3d/dist 复制；也可显式指定 Chili3D 仓库路径。
// =====================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'vendor', 'chili3d');

const candidates = [
  process.argv[2],
  path.resolve(ROOT, '..', 'chili3d', 'dist'),
  path.resolve(ROOT, '..', 'chili3d-dist')
].filter(Boolean);

const source = candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')));

if (!source) {
  console.error('未找到 Chili3D 构建产物。请先在 Chili3D 仓库执行 npm run build，');
  console.error('或用 `node scripts/sync-chili3d.mjs <path-to-chili3d/dist>` 指定路径。');
  process.exit(1);
}

console.log(`源: ${source}`);
fs.rmSync(TARGET, { recursive: true, force: true });
fs.cpSync(source, TARGET, { recursive: true });

// 移除 Microsoft Clarity 遥测脚本：本工具在桌面端离线使用，
// 不应把使用数据发送到第三方分析服务。
const indexPath = path.join(TARGET, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const before = html.length;
html = html.replace(/<script>!function\(t,e,n,c,r,a,i\)\{[\s\S]{0,600}?clarity\.ms[\s\S]{0,200}?<\/script>/, '');
if (html.length === before) {
  console.warn('警告：未匹配到 Clarity 遥测脚本，请人工检查 index.html。');
} else {
  console.log('已移除 Clarity 遥测脚本');
}
fs.writeFileSync(indexPath, html);

const count = fs.readdirSync(TARGET, { recursive: true }).filter((f) => {
  return typeof f === 'string' && fs.statSync(path.join(TARGET, f)).isFile();
}).length;
console.log(`已同步到 ${TARGET}（${count} 个文件）`);
