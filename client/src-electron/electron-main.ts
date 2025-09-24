/*
 * Authors: Michael Jagiello, Kevin Sirantoine, Maria Pasaylo, Rachel Patella
 * Created: 2025-04-13
 * Updated: 2025-09-24
 *
 * This file is the main Electron process that creates the application window, 
 * manages the system tray icon, and handles communication between the user 
 * interface and data storage (SQLite and electron-store).
 *
 * This file is a part of OpenOrganizer.
 * This file and all source code within it are governed by the copyright and 
 * license terms outlined in the LICENSE file located in the top-level directory of 
 * this distribution. No part of OpenOrganizer, including this file, may be reproduced, 
 * modified, distributed, or otherwise used except in accordance with the terms 
 * specified in the LICENSE file.
 */


import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url'
import { ipcMain } from 'electron';
import { read, create, update, deleteEntry} from './sqlitedb';
import { store } from './store';
import { browser } from 'globals';

// needed in case process is undefined under Linux
const platform = process.platform || os.platform();

const currentDir = fileURLToPath(new URL('.', import.meta.url));

let mainWindow: BrowserWindow | undefined;
let appIcon: Tray | undefined;

async function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    icon: path.resolve(currentDir, 'icons/icon.png'), // tray icon
    width: 1000,
    height: 600,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // More info: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: path.resolve(
        currentDir,
        path.join(process.env.QUASAR_ELECTRON_PRELOAD_FOLDER, 'electron-preload' + process.env.QUASAR_ELECTRON_PRELOAD_EXTENSION)
),
    },
  });

  if (process.env.DEV) {
    await mainWindow.loadURL(process.env.APP_URL);
  } else {
    await mainWindow.loadFile('index.html');
  }

  if (process.env.DEBUGGING) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools();
  } else {
    // we're on production; no access to devtools pls
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow?.webContents.closeDevTools();
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
}

void app.whenReady().then(async () => {
  await createWindow();
  let trayIcon = nativeImage.createFromPath(path.join(process.cwd(), 'src-electron', 'icons', 'cal.ico'));
  trayIcon = trayIcon.resize({ width: 16, height: 16 });
  appIcon = new Tray(trayIcon);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Quit', click: () => { app.quit(); } }
    //{ label: 'Show/Hide', click: () => { mainWindow?.show(); } },
  ])
    appIcon.setToolTip('Open Organizer');
    appIcon.setContextMenu(contextMenu);
  
  appIcon.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === undefined) {
    void createWindow();
  }
});

ipcMain.handle('sqliteRead', (event, key: string) => {
  return read(key);
});

ipcMain.handle('sqliteCreate', (event, key: string, value: string) => {
  create(key, value);
  return { success: true };
});

ipcMain.handle('sqliteUpdate', (event, key: string, value: string) => {
  update(key, value);
  return { success: true };
});

ipcMain.handle('sqliteDelete', (event, key: string) => {
  deleteEntry(key);
  return { success: true };
});

ipcMain.handle('getStoreName', () => {
  return store.get('name');
});

ipcMain.handle('setStoreName', (event, name: string) => {
  store.set('name', name);
  return true;
});
