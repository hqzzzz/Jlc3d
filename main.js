const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');
const { startStaticServer } = require('./server');

// 统一 User-Agent
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, compatible) Chrome/120.0.0.0 Safari/537.36';
axios.defaults.headers.common['User-Agent'] = USER_AGENT;

// 配置目录
const APP_DIR = path.join(os.homedir(), '.jlc3d');
const CONFIG_FILE = path.join(APP_DIR, 'config.json');

function ensureAppDir() {
  if (!fs.existsSync(APP_DIR)) {
    fs.mkdirSync(APP_DIR, { recursive: true });
  }
}

function saveDownloadPath(downloadPath) {
  ensureAppDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ downloadPath }, null, 2), 'utf-8');
}

function loadDownloadPath() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    return config.downloadPath || null;
  } catch (e) {
    return null;
  }
}

function getDefaultDesktop() {
  return path.join(os.homedir(), 'Desktop');
}

let mainWindow;
let editorWindow = null;
let staticServer = null;
let editorBaseUrl = null;

// Chili3D 构建产物与模型缓存目录
const CHILI3D_DIR = path.join(__dirname, 'vendor', 'chili3d');
const MODELS_DIR = path.join(APP_DIR, 'models');

function ensureModelsDir() {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }
}

// 启动内置静态服务器（仅监听 127.0.0.1，端口由系统分配）
async function ensureStaticServer() {
  if (staticServer) {
    return editorBaseUrl;
  }
  if (!fs.existsSync(path.join(CHILI3D_DIR, 'index.html'))) {
    throw new Error('未找到内置 Chili3D（vendor/chili3d），请先执行 npm run sync:chili3d');
  }
  ensureModelsDir();
  const { server, baseUrl } = await startStaticServer({ root: CHILI3D_DIR, filesDir: MODELS_DIR });
  staticServer = server;
  editorBaseUrl = baseUrl;
  return baseUrl;
}

// 打开 3D 编辑窗口；传入本地 STEP 文件路径则通过启动参数交给 Chili3D 打开
async function openEditorWindow(modelFileName) {
  const baseUrl = await ensureStaticServer();
  let target = `${baseUrl}/index.html`;
  if (modelFileName) {
    target += `?url=${encodeURIComponent(`${baseUrl}/files/${encodeURIComponent(modelFileName)}`)}`;
  }

  if (editorWindow && !editorWindow.isDestroyed()) {
    editorWindow.loadURL(target);
    editorWindow.maximize();
    editorWindow.focus();
    return true;
  }

  editorWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    center: true,
    icon: path.join(__dirname, 'resources', 'icon.ico'),
    title: '3D 模型编辑器 - Chili3D',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      // Chili3D 是独立的 Web 应用，不需要 node 集成，也不注入本项目 preload
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 编辑器内点击的外部链接同样交给系统浏览器
  editorWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 导出文件的保存位置：交由 Electron 默认的“另存为”对话框处理，让用户自行选择路径。
  // 注意：不要在 will-download 里调用 setSavePath —— 一旦设置就会静默下载到该路径、
  // 剥夺用户选择；而 dialog 在 will-download 中无法异步等待，故不自定义，直接用默认行为。

  // Chili3D 会设置 window.onbeforeunload（有活动视图时拦截关窗、弹原生“离开确认”），
  // 在桌面嵌入场景下导致窗口无法关闭。工程数据实时保存到 IndexedDB，此拦截无实际意义，
  // 故页面加载后把 onbeforeunload 重定义为空 setter，使任何赋值都失效。
  // 用 executeJavaScript 在页面主 world 执行（preload 处于 isolated world，覆盖不到）。
  const disableBeforeUnload = (wc) => {
    wc.executeJavaScript(
      "try{Object.defineProperty(window,'onbeforeunload',{configurable:false,enumerable:true,get:function(){return null;},set:function(){}});}catch(e){}"
    ).catch(() => {});
  };
  editorWindow.webContents.on('did-finish-load', () => disableBeforeUnload(editorWindow.webContents));

  editorWindow.loadURL(target);
  editorWindow.once('ready-to-show', () => {
    editorWindow.show();
    editorWindow.maximize();
  });
  editorWindow.on('closed', () => {
    editorWindow = null;
  });
  return true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    center: true,
    icon: path.join(__dirname, 'resources', 'icon.ico'),
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  // 拦截所有新窗口请求，在系统浏览器中打开外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (staticServer) {
      staticServer.close();
      staticServer = null;
    }
    app.quit();
  }
});

// IPC 处理器 - 下载 OBJ 文本（用于主界面即时 3D 预览；主进程取数，渲染进程不直接联网）
ipcMain.handle('fetch-obj-text', async (event, objUrl) => {
  try {
    const response = await axios.get(objUrl, { responseType: 'text', timeout: 30000 });
    return { success: true, text: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC 处理器 - 下载 STEP 文件到模型缓存目录（不弹框，供 3D 编辑使用）
ipcMain.handle('download-to-models-dir', async (event, modelUrl, filename) => {
  try {
    ensureModelsDir();
    const safeName = path.basename(filename);
    const target = path.join(MODELS_DIR, safeName);
    // 已缓存则直接复用，避免重复下载
    if (!fs.existsSync(target) || fs.statSync(target).size === 0) {
      const response = await axios.get(modelUrl, { responseType: 'arraybuffer' });
      fs.writeFileSync(target, response.data);
    }
    return { success: true, filepath: target };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC 处理器 - 打开 3D 编辑器（可传入本地 STEP 文件路径）
ipcMain.handle('open-3d-editor', async (event, modelFilePath) => {
  try {
    let fileName = null;
    if (modelFilePath && fs.existsSync(modelFilePath)) {
      ensureModelsDir();
      // 复制到模型目录并通过 /files/ 暴露给编辑器（编辑器只能访问 http 源）
      fileName = path.basename(modelFilePath);
      const target = path.join(MODELS_DIR, fileName);
      if (path.resolve(modelFilePath) !== path.resolve(target)) {
        fs.copyFileSync(modelFilePath, target);
      }
    }
    await openEditorWindow(fileName);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC 处理器 - 选择目录
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// IPC 处理器 - 获取下载路径
ipcMain.handle('get-download-path', () => {
  return loadDownloadPath() || getDefaultDesktop();
});

// IPC 处理器 - 保存下载路径
ipcMain.handle('save-download-path', (event, downloadPath) => {
  saveDownloadPath(downloadPath);
  return true;
});

// IPC 处理器 - 打开文件位置
ipcMain.handle('open-file-location', (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

// IPC 处理器 - 打开外部链接
ipcMain.handle('open-external-url', (event, url) => {
  shell.openExternal(url);
});

// IPC 处理器 - 最小化窗口
ipcMain.handle('minimize-window', (event) => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

// IPC 处理器 - 关闭窗口
ipcMain.handle('close-window', (event) => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// IPC 处理器 - 获取 package_uuid
ipcMain.handle('get-package-uuid', async (event, code) => {
  try {
    const response = await axios.get('https://lceda.cn/api/products/getPackageUuidByCodes', {
      params: { codes: code }
    });
    if (response.data.success && response.data.result?.data?.[0]) {
      return { success: true, packageUuid: response.data.result.data[0].package_uuid };
    } else {
      return { success: false, error: '未找到该器件' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC 处理器 - 获取 3D 模型信息
ipcMain.handle('get-model-info', async (event, packageUuid) => {
  try {
    const response = await axios.post(
      'https://lceda.cn/api/components/searchByUuids',
      { uuids: JSON.stringify([packageUuid]) },
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (response.data.success && response.data.result?.[0]) {
      const dataStr = response.data.result[0].dataStr;
      if (typeof dataStr === 'string') {
        const parsedData = JSON.parse(dataStr);
        return { success: true, modelInfo: parsedData };
      } else {
        return { success: true, modelInfo: dataStr };
      }
    } else {
      return { success: false, error: '该器件没有 3D 模型' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC 处理器 - 获取数据手册（规格书）PDF 链接
// 数据源为立创商城商品详情接口，无需鉴权，返回 result.pdfUrl。
ipcMain.handle('get-datasheet', async (event, code) => {
  try {
    const response = await axios.get('https://wmsc.lcsc.com/ftps/wm/product/detail', {
      params: { productCode: code },
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      timeout: 20000
    });
    if (response.data && response.data.code === 200 && response.data.result && response.data.result.pdfUrl) {
      const r = response.data.result;
      return { success: true, pdfUrl: r.pdfUrl, productName: r.productModel || '' };
    }
    return { success: false, error: '未找到数据手册' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC 处理器 - 下载 STEP 文件（弹出保存对话框）
ipcMain.handle('download-step-file', async (event, modelUrl, filename, defaultPath) => {
  try {
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      defaultPath: path.join(defaultPath || os.homedir(), filename),
      filters: [{ name: 'STEP 文件', extensions: ['step', 'stp'] }]
    });
    if (saveResult.canceled || !saveResult.filePath) {
      return { success: false, error: '用户取消了下载' };
    }
    const response = await axios.get(modelUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(saveResult.filePath, response.data);
    return { success: true, filepath: saveResult.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
