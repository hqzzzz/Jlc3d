# 嘉立创 3D 模型下载器

一个基于 Electron 的嘉立创元器件 3D 模型（STEP 文件）下载工具。

## 功能特点

- 查询嘉立创元器件信息
- 预览元器件引脚图和焊盘图
- 下载 3D 模型 STEP 文件
- 自定义下载路径保存

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

## 运行

开发模式运行：
```bash
npm start
```

## 使用说明

1. 在输入框中输入元器件编号（如：C8734）
2. 点击"查询"按钮获取元器件信息
3. 查看引脚图和焊盘图预览
4. 点击"下载 3D 模型"按钮下载 STEP 文件
5. 点击"关于"按钮查看软件信息

## 技术栈

- Electron
- Axios
- JavaScript (ES6+)

## 注意事项

- 需要网络连接才能查询和下载
- 部分元器件可能没有 3D 模型数据

## 许可证

MIT License

## 致谢

感谢 kulya97 的原始思路
