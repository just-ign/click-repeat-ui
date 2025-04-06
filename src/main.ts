import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import {mouse, Point, straightTo} from "@nut-tree-fork/nut-js";

async function drawFigureEight(centerX: number, centerY: number, size: number): Promise<void> {
    // Create points along a figure 8 path
    const steps = 30;
    const points: Point[] = [];
    
    // Generate points for the figure 8
    for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        // Use parametric equation for a figure 8 (lemniscate of Bernoulli)
        const x = centerX + size * Math.sin(angle) / (1 + Math.cos(angle) * Math.cos(angle));
        const y = centerY + size * Math.sin(angle) * Math.cos(angle) / (1 + Math.cos(angle) * Math.cos(angle));
        points.push(new Point(Math.round(x), Math.round(y)));
    }
    
    // Move mouse through each point
    for (const point of points) {
        await mouse.move(straightTo(point));
        // Small delay to slow down the movement and make it visible
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// TODO: Remove if not in development mode
// const MAIN_WINDOW_VITE_DEV_SERVER_URL = 'http://localhost:5173';
// const MAIN_WINDOW_VITE_NAME = 'renderer';

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 700,
    height: 60,
    frame: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// IPC handler for query
ipcMain.handle('handleQuery', async (event, query) => {
  console.log('Query received:', query);
  
  // Draw a figure 8 with the mouse
  await drawFigureEight(400, 400, 200);
  
  return { success: true };
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
