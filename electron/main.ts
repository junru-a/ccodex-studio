import { app, BrowserWindow, Menu, shell } from 'electron';
import * as path from 'path';
import { registerIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

function sendMenuAction(action: string): void {
  mainWindow?.webContents.send('menu:action', action);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    title: 'CCodex Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: '#101010',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: false,
  });

  registerIpcHandlers(mainWindow);

  if (isDev) {
    mainWindow.loadURL('http://localhost:9000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist-renderer', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(getMenuTemplate()));
}

function getMenuTemplate(): Electron.MenuItemConstructorOptions[] {
  return [
    {
      label: '\u6587\u4ef6',
      submenu: [
        { label: '\u65b0\u5bf9\u8bdd', accelerator: 'CmdOrCtrl+N', click: () => sendMenuAction('new-session') },
        { label: '\u6253\u5f00\u9879\u76ee...', accelerator: 'CmdOrCtrl+O', click: () => sendMenuAction('open-project') },
        { type: 'separator' },
        { label: '\u9000\u51fa', role: 'quit' },
      ],
    },
    {
      label: '\u7f16\u8f91',
      submenu: [
        { label: '\u64a4\u9500', role: 'undo' },
        { label: '\u91cd\u505a', role: 'redo' },
        { type: 'separator' },
        { label: '\u526a\u5207', role: 'cut' },
        { label: '\u590d\u5236', role: 'copy' },
        { label: '\u7c98\u8d34', role: 'paste' },
        { label: '\u5220\u9664', role: 'delete' },
        { type: 'separator' },
        { label: '\u5168\u9009', role: 'selectAll' },
      ],
    },
    {
      label: '\u67e5\u770b',
      submenu: [
        { label: '\u7ec8\u7aef\u89c6\u56fe', accelerator: 'CmdOrCtrl+1', click: () => sendMenuAction('view-terminal') },
        { label: '\u9605\u8bfb\u89c6\u56fe', accelerator: 'CmdOrCtrl+2', click: () => sendMenuAction('view-preview') },
        { type: 'separator' },
        { label: '\u5207\u6362\u5de6\u4fa7\u680f', accelerator: 'CmdOrCtrl+B', click: () => sendMenuAction('toggle-sidebar') },
        { label: '\u5207\u6362 Skills \u9762\u677f', accelerator: 'CmdOrCtrl+Shift+S', click: () => sendMenuAction('toggle-skills') },
        { type: 'separator' },
        { label: '\u91cd\u65b0\u52a0\u8f7d', role: 'reload' },
        { label: '\u5f00\u53d1\u8005\u5de5\u5177', role: 'toggleDevTools' },
        { label: '\u5168\u5c4f', role: 'togglefullscreen' },
      ],
    },
    {
      label: '\u8bed\u8a00',
      submenu: [
        { label: '\u4e2d\u6587', type: 'radio', checked: true, click: () => sendMenuAction('language-zh') },
        { label: 'English', type: 'radio', click: () => sendMenuAction('language-en') },
      ],
    },
    {
      label: '\u5e2e\u52a9',
      submenu: [
        { label: 'skills.sh', click: () => shell.openExternal('https://skills.sh') },
        { label: 'Claude Code Docs', click: () => shell.openExternal('https://docs.anthropic.com/claude-code') },
        { type: 'separator' },
        { label: '\u5173\u4e8e CCodex Studio', click: () => sendMenuAction('about') },
      ],
    },
  ];
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
