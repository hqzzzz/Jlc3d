// =====================================================
// UI 逻辑
// =====================================================
let downloadPath = '';
let lastDownloadFile = null;
let currentPackageUuid = null;
let currentModel3dUuid = null;

const codeInput = document.getElementById('codeInput');
const queryBtn = document.getElementById('queryBtn');
const resultSection = document.getElementById('resultSection');
const schematicContainer = document.getElementById('schematicContainer');
const pcbContainer = document.getElementById('pcbContainer');
const modelDownloadBtn = document.getElementById('modelDownloadBtn');
const logContainer = document.getElementById('logContainer');
const pathLabel = document.getElementById('pathLabel');
const changePathBtn = document.getElementById('changePathBtn');
const minimizeBtn = document.getElementById('minimizeBtn');
const closeBtn = document.getElementById('closeBtn');

// 日志输出（带链接记录）
function logMessage(msg, link = null, linkText = null) {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  
  const timeSpan = document.createElement('span');
  timeSpan.style.color = '#999';
  timeSpan.style.marginRight = '8px';
  timeSpan.textContent = `[${timeStr}]`;
  logEntry.appendChild(timeSpan);
  
  if (link && typeof link === 'string') {
    const textSpan = document.createElement('span');
    textSpan.textContent = msg;
    logEntry.appendChild(textSpan);
    
    const linkEl = document.createElement('a');
    linkEl.href = link;
    linkEl.textContent = linkText || '打开';
    linkEl.target = '_blank';
    linkEl.style.color = '#4a90d9';
    linkEl.style.textDecoration = 'none';
    linkEl.style.marginLeft = '8px';
    linkEl.style.fontWeight = '500';
    linkEl.onclick = (e) => {
      e.preventDefault();
      window.electronAPI.openExternalUrl(link);
    };
    logEntry.appendChild(linkEl);
  } else {
    logEntry.appendChild(document.createTextNode(msg));
  }
  
  logContainer.insertBefore(logEntry, logContainer.firstChild);
}

function showResultSection() {
  resultSection.style.display = 'block';
}

function hideResultSection() {
  resultSection.style.display = 'none';
}

async function selectDownloadPath() {
  const selectedPath = await window.electronAPI.selectDirectory();
  if (selectedPath) {
    downloadPath = selectedPath;
    pathLabel.textContent = `下载位置：${downloadPath}`;
    logMessage(`下载路径已设置为：${downloadPath}`);
  }
}

function hideAbout() {
  aboutDialog.style.display = 'none';
}

function exitApp() {
  window.electronAPI.closeWindow();
}

// 窗口控制按钮事件
if (minimizeBtn) {
  minimizeBtn.addEventListener('click', () => {
    window.electronAPI.minimizeWindow();
  });
}

if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    window.electronAPI.closeWindow();
  });
}

// 从 shape 数组中提取 3D 模型 UUID
function extract3dModelUuid(modelInfo) {
  if (!modelInfo.shape || !Array.isArray(modelInfo.shape)) {
    return null;
  }
  for (const shape of modelInfo.shape) {
    if (shape.startsWith('SVGNODE~')) {
      try {
        const jsonPart = shape.substring('SVGNODE~'.length);
        const svgData = JSON.parse(jsonPart);
        if (svgData.attrs?.uuid) {
          return svgData.attrs.uuid;
        }
      } catch (e) {
        // 解析失败，继续下一个
      }
    }
  }
  return null;
}

// 提取引脚图 PNG URL（从 API 数据）
function extractSchematicPngUrl(svgsData) {
  // docType: 2 = 原理图符号
  for (const item of svgsData) {
    if (item.docType === 2 && item.png) {
      // URL 可能以 // 开头，需要补全协议
      let pngUrl = item.png;
      if (pngUrl.startsWith('//')) {
        pngUrl = 'https:' + pngUrl;
      }
      return pngUrl;
    }
  }
  return null;
}

// 提取焊盘图 PNG URL（从 API 数据）
function extractPcbPngUrl(svgsData) {
  // docType: 4 = PCB 封装
  for (const item of svgsData) {
    if (item.docType === 4 && item.png) {
      // URL 可能以 // 开头，需要补全协议
      let pngUrl = item.png;
      if (pngUrl.startsWith('//')) {
        pngUrl = 'https:' + pngUrl;
      }
      return pngUrl;
    }
  }
  return null;
}

// 查询按钮点击事件
async function queryProduct() {
  const code = codeInput.value.trim();
  if (!code) {
    alert('请输入元器件编号');
    return;
  }
  
  queryBtn.disabled = true;
  queryBtn.textContent = '查询中...';
  queryBtn.classList.add('downloading');
  hideResultSection();
  schematicContainer.innerHTML = '';
  pcbContainer.innerHTML = '';
  logMessage(`查询器件【${code}】...`);
  
  try {
    // 第一步：获取 package_uuid
    logMessage('获取 package_uuid...');
    const packageUuidResult = await window.electronAPI.getPackageUuid(code);
    if (!packageUuidResult.success) {
      throw new Error(packageUuidResult.error || '获取 package_uuid 失败');
    }
    currentPackageUuid = packageUuidResult.packageUuid;
    logMessage(`package_uuid: ${currentPackageUuid}`);
    
    // 第二步：获取 3D 模型信息
    logMessage('获取 3D 模型信息...');
    const modelInfoResult = await window.electronAPI.getModelInfo(currentPackageUuid);
    if (!modelInfoResult.success) {
      throw new Error(modelInfoResult.error || '获取 3D 模型信息失败');
    }
    const modelData = modelInfoResult.modelInfo;
    
    // 提取 3D 模型 UUID
    currentModel3dUuid = extract3dModelUuid(modelData);
    if (currentModel3dUuid) {
      logMessage(`3D 模型 UUID: ${currentModel3dUuid}`);
    }
    
    // 第三步：获取 PNG 数据（引脚图和焊盘图）
    logMessage('获取图片数据...');
    const svgApiUrl = `https://lceda.cn/api/products/${code}/svgs`;
    try {
      const response = await fetch(svgApiUrl);
      const svgData = await response.json();
      if (svgData.success && svgData.result) {
        // 提取并显示引脚图 PNG（docType: 2）
        const schematicPngUrl = extractSchematicPngUrl(svgData.result);
        if (schematicPngUrl) {
          schematicContainer.innerHTML = `<img src="${schematicPngUrl}" alt="引脚图" style="max-width:100%;max-height:100%;object-fit:contain;">`;
          logMessage('已加载引脚图预览');
        } else {
          schematicContainer.innerHTML = '<div style="color:#999;padding:40px;">暂无引脚图预览</div>';
        }
        
        // 提取并显示焊盘图 PNG（docType: 4）
        const pcbPngUrl = extractPcbPngUrl(svgData.result);
        if (pcbPngUrl) {
          pcbContainer.innerHTML = `<img src="${pcbPngUrl}" alt="焊盘图" style="max-width:100%;max-height:100%;object-fit:contain;">`;
          logMessage('已加载焊盘图预览');
        } else {
          pcbContainer.innerHTML = '<div style="color:#999;padding:40px;">暂无焊盘图预览</div>';
        }
      } else {
        schematicContainer.innerHTML = '<div style="color:#999;padding:40px;">暂无引脚图预览</div>';
        pcbContainer.innerHTML = '<div style="color:#999;padding:40px;">暂无焊盘图预览</div>';
      }
    } catch (e) {
      console.error('获取图片失败:', e);
      schematicContainer.innerHTML = '<div style="color:#999;padding:40px;">暂无引脚图预览</div>';
      pcbContainer.innerHTML = '<div style="color:#999;padding:40px;">暂无焊盘图预览</div>';
    }
    
    if (currentModel3dUuid) {
      const modelUrl = `https://modules.lceda.cn/qAxj6KHrDKw4blvCG8QJPs7Y/${currentModel3dUuid}`;
      logMessage('3D 模型 STEP:', modelUrl, '下载');
    }
    
    // 显示结果区域
    showResultSection();
    logMessage('查询完成 ✔');
    
  } catch (error) {
    logMessage(`错误：${error.message}`);
    hideResultSection();
  } finally {
    queryBtn.disabled = false;
    queryBtn.textContent = '查询';
    queryBtn.classList.remove('downloading');
  }
}

// 下载 3D 模型
async function downloadModel() {
  if (!currentModel3dUuid) {
    alert('该器件没有 3D 模型');
    return;
  }
  
  const code = codeInput.value.trim();
  const stepUrl = `https://modules.lceda.cn/qAxj6KHrDKw4blvCG8QJPs7Y/${currentModel3dUuid}`;
  const filename = `${code}.step`;
  
  queryBtn.disabled = true;
  queryBtn.textContent = '下载中...';
  logMessage(`准备下载 3D 模型：${filename}`);
  
  try {
    const downloadResult = await window.electronAPI.downloadStepFile(stepUrl, filename, downloadPath);
    if (!downloadResult.success) {
      throw new Error(downloadResult.error || '下载失败');
    }
    lastDownloadFile = downloadResult.filepath;
    logMessage(`下载完成 ✔`);
    logMessage(`保存至：${lastDownloadFile}`);
    
    // 更新下载路径为保存位置
    downloadPath = path.dirname(lastDownloadFile);
    pathLabel.textContent = `下载至：${downloadPath}`;
  } catch (error) {
    logMessage(`错误：${error.message}`);
  } finally {
    queryBtn.disabled = false;
    queryBtn.textContent = '查询';
  }
}

// 事件绑定
queryBtn.addEventListener('click', queryProduct);
modelDownloadBtn.addEventListener('click', downloadModel);
changePathBtn.addEventListener('click', selectDownloadPath);
closeAboutBtn.addEventListener('click', hideAbout);

// 点击对话框外部关闭
aboutDialog.addEventListener('click', (e) => {
  if (e.target === aboutDialog) {
    hideAbout();
  }
});

// 回车键触发查询
codeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    queryProduct();
  }
});

// 初始化
logMessage('欢迎使用嘉立创 3D 模型下载器');
