import { app, BrowserWindow, screen, ipcMain } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { setupQueryHandler } from "./general-agent";

const INITIAL_WINDOW_HEIGHT = 40; // Base height if no history
const MAX_WINDOW_HEIGHT = 350; // Increased Max height to match App.tsx
const INITIAL_WINDOW_WIDTH = 400;
const RECORDING_WINDOW_WIDTH = 130; // Match App.tsx
// const RECORDING_WINDOW_HEIGHT = 36; // Remove
// const MAX_WINDOW_WIDTH = 600; // Optional

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// TODO: Remove if not in development mode
const MAIN_WINDOW_VITE_DEV_SERVER_URL = "http://localhost:5173";
const MAIN_WINDOW_VITE_NAME = "renderer";

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Get the primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: displayWidth, height: displayHeight } =
    primaryDisplay.workAreaSize;

  // Calculate window position to place it at the top 30% area
  const windowX = Math.floor((displayWidth - INITIAL_WINDOW_WIDTH) / 2); // Center horizontally
  const windowY = Math.floor(displayHeight * 0.3); // Place at 30% from the top

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: INITIAL_WINDOW_WIDTH,
    height: INITIAL_WINDOW_HEIGHT,
    x: windowX,
    y: windowY,
    frame: false,
    resizable: true,
    minWidth: INITIAL_WINDOW_WIDTH,
    minHeight: INITIAL_WINDOW_HEIGHT,
    maxWidth: displayWidth, 
    maxHeight: MAX_WINDOW_HEIGHT, // Use updated max height
    movable: true,
    fullscreenable: false,
    maximizable: false,
    acceptFirstMouse: true,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMovable(true);
  
  // Remove the previous will-resize handler as resizing is now controlled by content
  // mainWindow.on('will-resize', ...);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
};

// Handle window mode toggling from renderer
ipcMain.handle('toggleWindowMode', (_event, data) => {
  if (!mainWindow) return { success: false, error: 'Main window not available' };

  try {
    const currentBounds = mainWindow.getBounds();
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: displayWidth, height: displayHeight } = primaryDisplay.workAreaSize;
    
    // Use requested size directly from data for ALL modes first
    let targetWidth = data.width ?? currentBounds.width;
    let targetHeight = data.height ?? currentBounds.height;

    // Apply constraints/clamping based on mode AFTER getting initial target
    if (data.mode === 'recording') {
        // Recording mode might have different constraints if needed in the future,
        // but for now, we just use the values from App.tsx.
        // Ensure minimums aren't violated (optional, but safe)
        targetWidth = Math.max(50, targetWidth); // Example minimum width
        targetHeight = Math.max(30, targetHeight); // Example minimum height
    } else {
        // Clamp dimensions for non-recording modes
        targetWidth = Math.max(INITIAL_WINDOW_WIDTH, Math.min(targetWidth, displayWidth));
        targetHeight = Math.max(INITIAL_WINDOW_HEIGHT, Math.min(targetHeight, MAX_WINDOW_HEIGHT));
    }
    
    let targetX, targetY;

    // Determine position based on mode
    if (data.mode === "minimized") {
      // Top right
      targetX = displayWidth - targetWidth - 20; 
      targetY = 40; 
    } else {
      // Initial AND Recording: Center horizontally, position near bottom
      targetX = Math.floor((displayWidth - targetWidth) / 2);
      targetY = displayHeight - targetHeight - 60; 
    }

    // Only resize/reposition if needed
    // Separate size and position steps for potential timing issues
    let sizeChanged = false;
    if (targetWidth !== currentBounds.width || targetHeight !== currentBounds.height) {
      mainWindow.setSize(targetWidth, targetHeight, false); // Set size without animation
      sizeChanged = true;
    }

    // Recalculate targetX *after* potential resize and before setting position
    // This ensures we use the most up-to-date window width for centering
    const currentWindowBounds = mainWindow.getBounds(); // Get potentially updated bounds
    const currentDisplay = screen.getDisplayMatching(currentWindowBounds); // Get display based on current pos
    const currentDisplayWidth = currentDisplay.workAreaSize.width;
    const currentWindowWidth = currentWindowBounds.width;
    
    let finalTargetX;
    if (data.mode === "minimized") {
        finalTargetX = currentDisplayWidth - currentWindowWidth - 20; 
        // mainWindow.setBackgroundColor('#141416'); // Reverted: Set opaque background for minimized
    } else { // Initial & Recording
        finalTargetX = Math.floor((currentDisplayWidth - currentWindowWidth) / 2);
        // mainWindow.setBackgroundColor('#00000000'); // Reverted: Set back to transparent
    }
    
    // Only set position if needed (position might differ even if coords are same due to display changes)
    if (finalTargetX !== currentWindowBounds.x || targetY !== currentWindowBounds.y) {
       mainWindow.setPosition(finalTargetX, targetY, false); // Set position without animation
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to toggle window mode:", error);
    return { success: false, error: error.message };
  }
});

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
