const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  getDownloadPath: () => ipcRenderer.invoke('get-download-path'),
  saveDownloadPath: (downloadPath) => ipcRenderer.invoke('save-download-path', downloadPath),
  openFileLocation: (filePath) => ipcRenderer.invoke('open-file-location', filePath),
  openExternalUrl: (url) => ipcRenderer.invoke('open-external-url', url),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  getPackageUuid: (code) => ipcRenderer.invoke('get-package-uuid', code),
  getModelInfo: (packageUuid) => ipcRenderer.invoke('get-model-info', packageUuid),
  downloadStepFile: (modelUrl, filename) => ipcRenderer.invoke('download-step-file', modelUrl, filename)
});
