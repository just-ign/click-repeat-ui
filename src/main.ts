import { app, BrowserWindow, screen } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { setupQueryHandler } from "./general-agent";

const MAIN_WINDOW_HEIGHT = 60;
const MAIN_WINDOW_WIDTH = 700;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// TODO: Remove if not in development mode
const MAIN_WINDOW_VITE_DEV_SERVER_URL = "http://localhost:5173";
const MAIN_WINDOW_VITE_NAME = "renderer";

const createWindow = () => {
  // Get the primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: displayWidth, height: displayHeight } =
    primaryDisplay.workAreaSize;

  // Calculate window position to place it at the top 30% area
  const windowX = Math.floor((displayWidth - MAIN_WINDOW_WIDTH) / 2); // Center horizontally
  const windowY = Math.floor(displayHeight * 0.3); // Place at 30% from the top

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: MAIN_WINDOW_WIDTH,
    height: MAIN_WINDOW_HEIGHT,
    x: windowX,
    y: windowY,
    frame: false,
    resizable: false,
    movable: true, // Make sure window is movable
    fullscreenable: false,
    maximizable: false,
    acceptFirstMouse: true, // Activate the window when clicking on any UI element
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Allow window to be moved between different displays
  mainWindow.setMovable(true);

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
};

// Set up the query handler
setupQueryHandler();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
