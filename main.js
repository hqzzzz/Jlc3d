const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const axios = require('axios');

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    center: true,
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
    app.quit();
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
