const { app, BrowserWindow, Menu, nativeTheme, ipcMain } = require('electron');
const path = require('path');

// 界面按 1440×900 设计，窗口变大变小时整体等比缩放
const DESIGN_W = 1440;
const DESIGN_H = 900;

function fit(win) {
  const [w, h] = win.getContentSize();
  const zoom = Math.max(0.7, Math.min(1.6, Math.min(w / DESIGN_W, h / DESIGN_H)));
  win.webContents.setZoomFactor(zoom);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1100,
    minHeight: 690,
    title: '一行',
    icon: path.join(__dirname, 'src', 'icon.ico'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#14142b' : '#ffffff',
    // 不要系统标题栏；最小化 / 最大化 / 关闭三个按钮由页面自己画（见 index.html 的 #win-ctl）
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'src', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  // F5 刷新：改完代码不用重启就能看到效果
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F5') win.reload();
  });
  const refit = () => !win.isDestroyed() && fit(win);
  win.on('resize', refit);
  win.webContents.on('did-finish-load', refit);
  // 告诉页面窗口是不是最大化了，中间那个按钮要在「最大化 / 还原」之间换图标
  const tellMax = () => !win.isDestroyed() && win.webContents.send('win-max', win.isMaximized());
  win.on('maximize', tellMax);
  win.on('unmaximize', tellMax);
  win.webContents.on('did-finish-load', tellMax);
}

// 设置里的外观选项：页面的深浅色跟着变
ipcMain.on('set-theme', (e, theme) => {
  if (['system', 'light', 'dark'].includes(theme)) nativeTheme.themeSource = theme;
});

// 页面上的窗口按钮
ipcMain.on('win', (e, action) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return;
  if (action === 'min') win.minimize();
  else if (action === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (action === 'close') win.close();
});

// 添加文章时给日语汉字自动注音（词典较大，第一次用到时才加载）
ipcMain.handle('annotate', (e, text) => require('./src/furigana').annotate(String(text).slice(0, 20000)));

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
