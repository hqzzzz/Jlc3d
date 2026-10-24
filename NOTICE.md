# 许可与第三方声明 (NOTICE)

本项目「嘉立创 3D 模型下载器」自 v1.3.0 起内置了 [Chili3D](https://github.com/xiangechen/chili3d)，
用于在应用内查看与编辑 3D 模型（STEP / IGES / BREP 的导入、B-Rep 编辑与导出）。

## 许可证变更

Chili3D 采用 **GNU AGPL-3.0** 许可。由于本项目在其发行包中包含 Chili3D 的代码与构建产物，
构成 AGPL 意义上的“基于作品的作品 (work that is based on the Program)”，
因此本项目整体同样以 **GNU AGPL-3.0** 发布（此前版本为 MIT）。完整条款见同目录下的 `LICENSE`。

要点（对用户而言）：

- 你可以自由运行、研究、修改、分发本程序。
- 如果你分发修改版，或以网络服务形式对外提供修改版，必须**在相同许可下公开全部源码**（含你对 Chili3D 的改动）。
- 保留本 NOTICE、Chili3D 版权声明与 `LICENSE`。

## 内置第三方组件

| 组件 | 用途 | 上游 | 许可 |
|------|------|------|------|
| Chili3D | 内置 3D CAD 编辑器（随包分发于 `vendor/chili3d/`） | github.com/xiangechen/chili3d | AGPL-3.0 |
| OpenCascade (OCCT) | Chili3D 编译为 WebAssembly 的几何内核 | 经 Chili3D 集成 | LGPL-2.1（含例外） |
| three.js | Chili3D 的 WebGL 渲染 | github.com/mrdoob/three.js | MIT |
| Electron | 桌面运行时 | github.com/electron/electron | MIT |
| axios | HTTP 客户端 | github.com/axios/axios | MIT |

## 对 Chili3D 的改动

1. 从 `vendor/chili3d/index.html` 中移除了 Microsoft Clarity 遥测脚本
   （本工具在本地桌面环境离线使用，不向第三方分析服务发送使用数据）。
   该移除逻辑固化在 `scripts/sync-chili3d.mjs` 中。
2. 由内置静态服务器（`server.js`，仅监听 127.0.0.1）托管，
   以提供 Chili3D 所需的 http 源与 IndexedDB 能力。

上述改动及本项目全部源码应随发行版一并提供。
