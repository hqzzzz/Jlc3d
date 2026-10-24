# 嘉立创 3D 模型下载器

一个基于 Electron 的嘉立创元器件 3D 模型工具：查询器件、即时 3D 预览、下载 STEP，并可直接在内置 CAD 编辑器中修改后存回 STEP。

## 功能特点

- 查询嘉立创元器件信息
- 预览元器件引脚图和焊盘图
- **即时 3D 预览**：查询时在第三列用 three.js 实时渲染器件 OBJ（数据源与立创在线 3D 预览一致，秒开）
- 下载 3D 模型 STEP 文件
- **3D 编辑**：一键把器件 STEP 载入内置 Chili3D 编辑器，做布尔、圆角/倒角、修剪/分割等 B-Rep 编辑，再导出 STEP/IGES/BREP/STL/OBJ
- 自定义下载路径保存（记忆上次位置）

> 预览与编辑用的是两套数据：预览走 OBJ（轻量、即时），编辑走 STEP（精确 B-Rep）。这与立创官网的机制相同。

## 系统要求

- Node.js 16+
- npm 或 yarn

## 安装

1. 克隆项目：
```bash
git clone https://github.com/hqzzzz/Jlc3d.git
cd Jlc3d
```

2. 安装依赖：
```bash
npm install
```

3. 构建内置 3D 组件（首次或上游更新后执行）：
```bash
npm run build:viewer   # 打包内联 3D 预览器 (three.js) 到 vendor/objviewer.js
npm run sync:chili3d   # 从 ../chili3d/dist 同步 Chili3D 到 vendor/chili3d
```
> `sync:chili3d` 需要一个已构建的 Chili3D（在其仓库执行 `npm run build`），或用 `node scripts/sync-chili3d.mjs <path>` 指定其 dist 路径。

## 运行

开发模式运行：
```bash
npm start
```

## 打包

```bash
npm run build            # NSIS 安装包
npm run build:portable   # 便携版 exe（会自动先构建内置 3D 组件）
```

## 使用说明

1. 在输入框中输入元器件编号（如：C8734）
2. 点击"查询"按钮获取元器件信息，第三列会自动渲染即时 3D 预览
3. 点击"下载 3D 模型"下载 STEP 文件
4. 点击"3D 编辑"在内置 Chili3D 编辑器中打开该器件（首次会自动下载 STEP 到缓存目录）

## 技术栈

- Electron
- Axios
- three.js（内联 3D 预览）
- Chili3D（内置 CAD 编辑器，随包分发）

## 注意事项

- 需要网络连接才能查询和下载
- 部分元器件可能没有 3D 模型数据
- 内置 3D 编辑器由本地静态服务器（仅监听 127.0.0.1）托管，以获得所需的 http 源与 IndexedDB 能力

## 许可证

**AGPL-3.0-only**

自 v1.3.0 起，本项目内置了 AGPL-3.0 的 Chili3D，据 AGPL 条款整体以 AGPL-3.0 发布（此前为 MIT）。完整条款见 `LICENSE`，第三方组件与对本项目的改动见 `NOTICE.md`。若你分发修改版或以网络服务形式提供，须在相同许可下公开全部源码。

## 致谢

- 感谢 kulya97 的原始思路
- 感谢 [Chili3D](https://github.com/xiangechen/chili3d)（AGPL-3.0）及其底层的 OpenCascade、three.js
