import { ipcMain, BrowserWindow, screen, desktopCapturer } from "electron";
import {
  mouse,
  Point,
  straightTo,
  Button,
  keyboard,
  Key,
} from "@nut-tree-fork/nut-js";
import * as fs from "fs";
import * as path from "path";

const EXPANDED_MAIN_WINDOW_HEIGHT = 300;
const EXPANDED_MAIN_WINDOW_WIDTH = 700;
const MAIN_WINDOW_HEIGHT = 60;
const MAIN_WINDOW_WIDTH = 700;

// Target dimensions for scaled screenshots (matching Python's FWXGA target)
const TARGET_DIMENSIONS = {
  width: 1366,
  height: 768,
};

// Flag to enable/disable coordinate scaling
const SCALING_ENABLED = true;

// Helper function to send progress updates to the renderer
function sendProgressUpdate(message: AgentMessage): void {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    windows[0].webContents.send("agent-progress", message);
  }
}

// Helper function to scale coordinates between real screen and target dimensions
function scaleCoordinates(
  fromApi: boolean,
  x: number,
  y: number
): [number, number] {
  if (!SCALING_ENABLED) {
    return [x, y];
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size

  // Calculate scaling factors exactly like the Python implementation
  const xScalingFactor = TARGET_DIMENSIONS.width / width;
  const yScalingFactor = TARGET_DIMENSIONS.height / height;

  if (fromApi) {
    // Scale from API dimensions to actual screen dimensions (API → Screen)
    if (x > TARGET_DIMENSIONS.width || y > TARGET_DIMENSIONS.height) {
      console.error(`Coordinates ${x}, ${y} are out of bounds`);
      // Clamp values to prevent errors
      x = Math.min(x, TARGET_DIMENSIONS.width);
      y = Math.min(y, TARGET_DIMENSIONS.height);
    }
    // Exactly like Python's "scale up to real screen coordinates"
    return [Math.round(x / xScalingFactor), Math.round(y / yScalingFactor)];
  } else {
    // Scale from actual screen dimensions to API dimensions (Screen → API)
    return [Math.round(x * xScalingFactor), Math.round(y * yScalingFactor)];
  }
}

// Helper function to format action details for human-readable output
function formatActionDetails(action: AgentAction): string {
  switch (action.tool_input.action) {
    case "key":
      return `Pressing key: ${action.tool_input.text}`;

    case "hold_key":
      return `Holding key: ${action.tool_input.text}${
        action.tool_input.duration ? ` for ${action.tool_input.duration}ms` : ""
      }`;

    case "type":
      return `Typing text: "${action.tool_input.text}"`;

    case "cursor_position":
      return `Getting cursor position`;

    case "mouse_move":
      return action.tool_input.coordinate
        ? `Moving mouse to position (${action.tool_input.coordinate[0]}, ${action.tool_input.coordinate[1]})`
        : `Moving mouse`;

    case "left_mouse_down":
      return action.tool_input.coordinate
        ? `Pressing left button at position (${action.tool_input.coordinate[0]}, ${action.tool_input.coordinate[1]})`
        : `Pressing left button`;

    case "left_mouse_up":
      return action.tool_input.coordinate
        ? `Releasing left button at position (${action.tool_input.coordinate[0]}, ${action.tool_input.coordinate[1]})`
        : `Releasing left button`;

    case "left_click":
      return action.tool_input.coordinate
        ? `Clicking left button at position (${action.tool_input.coordinate[0]}, ${action.tool_input.coordinate[1]})`
        : `Clicking left button`;

    case "left_click_drag":
      return action.tool_input.coordinate
        ? `Dragging with left button from (${action.tool_input.start_coordinate[0]}, ${action.tool_input.start_coordinate[1]}) to (${action.tool_input.coordinate[0]}, ${action.tool_input.coordinate[1]})`
        : `Dragging with left button`;

    case "right_click":
      return action.tool_input.coordinate
        ? `Clicking right button at position (${action.tool_input.coordinate[0]}, ${action.tool_input.coordinate[1]})`
        : `Clicking right button`;

    case "middle_click":
      return action.tool_input.coordinate
        ? `Clicking middle button at position (${action.tool_input.coordinate[0]}, ${action.tool_input.coordinate[1]})`
        : `Clicking middle button`;

    case "double_click":
      return action.tool_input.coordinate
        ? `Double-clicking at position (${action.tool_input.coordinate[0]}, ${action.tool_input.coordinate[1]})`
        : `Double-clicking`;

    case "triple_click":
      return action.tool_input.coordinate
        ? `Triple-clicking at position (${action.tool_input.coordinate[0]}, ${action.tool_input.coordinate[1]})`
        : `Triple-clicking`;

    case "scroll":
      return `Scrolling ${action.tool_input.scroll_direction || "down"}${
        action.tool_input.scroll_amount
          ? ` by ${action.tool_input.scroll_amount}`
          : ""
      }`;

    case "wait":
      return `Waiting${
        action.tool_input.duration ? ` for ${action.tool_input.duration}ms` : ""
      }`;

    case "screenshot":
      return "Taking screenshot";

    default:
      return `Unknown action: ${action.action}`;
  }
}

// Function to take a screenshot of the primary display and encode it as base64
async function takeScreenshot(): Promise<string | null> {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    
    // Create screenshots directory if it doesn't exist
    const screenshotsDir = path.join(process.cwd(), "screenshots");
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Generate a filename based on current date/time
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const filename = path.join(screenshotsDir, `screenshot-${timestamp}.png`);

    // First, capture the full-size screenshot
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width, height },
    });

    // Find the primary display source
    const primarySource = sources.find(
      (source) =>
        source.display_id === primaryDisplay.id.toString() ||
        sources.length === 1
    );

    if (primarySource && primarySource.thumbnail) {
      // Get the NativeImage from the thumbnail
      const originalImage = primarySource.thumbnail;
      
      // Forcibly resize the image to TARGET_DIMENSIONS without preserving aspect ratio
      const resizedImage = originalImage.resize({
        width: TARGET_DIMENSIONS.width,
        height: TARGET_DIMENSIONS.height,
        quality: 'best'
      });
      
      // Save the resized image
      const pngBuffer = resizedImage.toPNG();
      fs.writeFileSync(filename, pngBuffer);
      
      // Convert to base64 for sending to server
      const base64Image = pngBuffer.toString("base64");

      // If the WebSocket is available, send the screenshot to the server
      if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        wsClient.send(
          JSON.stringify({
            action: "tool_response",
            output: `Screenshot saved to ${filename}`,
            base64_image: base64Image,
          })
        );
      }
      return filename;
    } else {
      throw new Error("Could not find primary display source");
    }
  } catch (error) {
    console.error("Screenshot error:", error);
    const errorMessage: AgentMessage = {
      type: "action-error",
      content: `Screenshot failed: ${error.message}`,
      timestamp: Date.now(),
    };
    sendProgressUpdate(errorMessage);
    return null;
  }
}

// Execute a single action
async function executeAction(action: AgentAction) {
  // Send progress update to renderer
  const agentMessage: AgentMessage = {
    type: "action-progress",
    content: formatActionDetails(action),
    timestamp: Date.now(),
    actionDetails: action,
  };
  sendProgressUpdate(agentMessage);

  try {
    let result;
    let position;
    let apiX, apiY;
    let screenX, screenY;
    let filename;

    switch (action.tool_input.action) {
      case "key":
        await keyboard.pressKey(action.tool_input.text as unknown as Key);
        break;

      case "hold_key":
        await keyboard.pressKey(action.tool_input.text as unknown as Key);
        break;

      case "type":
        await keyboard.type(action.tool_input.text);
        break;

      case "cursor_position":
        position = await mouse.getPosition();
        // Scale the coordinates to API dimensions
        [apiX, apiY] = scaleCoordinates(false, position.x, position.y);
        result = {
          output: `X=${apiX},Y=${apiY}`,
          tool_id: action.tool_id,
        };
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
          wsClient.send(JSON.stringify(result));
        }
        return position;

      case "mouse_move":
        if (action.tool_input.coordinate) {
          // Scale from API dimensions to screen dimensions
          [screenX, screenY] = scaleCoordinates(
            true,
            action.tool_input.coordinate[0],
            action.tool_input.coordinate[1]
          );
          await mouse.move(straightTo(new Point(screenX, screenY)));
        }
        break;

      case "left_mouse_down":
        await mouse.pressButton(Button.LEFT);
        break;

      case "left_mouse_up":
        await mouse.releaseButton(Button.LEFT);
        break;

      case "left_click":
        if (action.tool_input.coordinate) {
          // Scale from API dimensions to screen dimensions
          [screenX, screenY] = scaleCoordinates(
            true,
            action.tool_input.coordinate[0],
            action.tool_input.coordinate[1]
          );
          await mouse.move(straightTo(new Point(screenX, screenY)));
        }
        await mouse.click(Button.LEFT);
        break;

      case "left_click_drag":
        if (action.tool_input.coordinate) {
          // Scale from API dimensions to screen dimensions
          [screenX, screenY] = scaleCoordinates(
            true,
            action.tool_input.coordinate[0],
            action.tool_input.coordinate[1]
          );
          await mouse.pressButton(Button.LEFT);
          await mouse.move(straightTo(new Point(screenX, screenY)));
        }
        break;

      case "right_click":
        if (action.tool_input.coordinate) {
          // Scale from API dimensions to screen dimensions
          [screenX, screenY] = scaleCoordinates(
            true,
            action.tool_input.coordinate[0],
            action.tool_input.coordinate[1]
          );
          await mouse.move(straightTo(new Point(screenX, screenY)));
        }
        await mouse.click(Button.RIGHT);
        break;

      case "middle_click":
        if (action.tool_input.coordinate) {
          // Scale from API dimensions to screen dimensions
          [screenX, screenY] = scaleCoordinates(
            true,
            action.tool_input.coordinate[0],
            action.tool_input.coordinate[1]
          );
          await mouse.move(straightTo(new Point(screenX, screenY)));
        }
        await mouse.click(Button.MIDDLE);
        break;

      case "double_click":
        if (action.tool_input.coordinate) {
          // Scale from API dimensions to screen dimensions
          [screenX, screenY] = scaleCoordinates(
            true,
            action.tool_input.coordinate[0],
            action.tool_input.coordinate[1]
          );
          await mouse.move(straightTo(new Point(screenX, screenY)));
        }
        await mouse.doubleClick(Button.LEFT);
        break;

      case "triple_click":
        if (action.tool_input.coordinate) {
          // Scale from API dimensions to screen dimensions
          [screenX, screenY] = scaleCoordinates(
            true,
            action.tool_input.coordinate[0],
            action.tool_input.coordinate[1]
          );
          await mouse.move(straightTo(new Point(screenX, screenY)));
        }
        await mouse.doubleClick(Button.LEFT);
        await mouse.click(Button.LEFT);
        break;

      case "scroll":
        if (action.tool_input.coordinate) {
          // Scale from API dimensions to screen dimensions
          [screenX, screenY] = scaleCoordinates(
            true,
            action.tool_input.coordinate[0],
            action.tool_input.coordinate[1]
          );
          await mouse.move(straightTo(new Point(screenX, screenY)));
        }

        if (action.tool_input.scroll_direction === "up") {
          await mouse.scrollUp(action.tool_input.scroll_amount);
        } else if (action.tool_input.scroll_direction === "down") {
          await mouse.scrollDown(action.tool_input.scroll_amount);
        } else if (action.tool_input.scroll_direction === "left") {
          await mouse.scrollLeft(action.tool_input.scroll_amount);
        } else if (action.tool_input.scroll_direction === "right") {
          await mouse.scrollRight(action.tool_input.scroll_amount);
        }
        break;

      case "wait":
        await new Promise((resolve) =>
          setTimeout(resolve, action.tool_input.duration)
        );
        break;

      case "screenshot":
        filename = await takeScreenshot();
        result = {
          output: filename
            ? `Screenshot saved to ${filename}`
            : "Screenshot failed",
          tool_id: action.tool_id,
        };
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
          wsClient.send(JSON.stringify(result));
        }
        return filename;
    }

    // Send acknowledgment of completed action
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.send(
        JSON.stringify({
          tool_id: action.tool_id,
          output: `Completed action: ${action.tool_input.action}`,
        })
      );
    }
  } catch (error) {
    console.error(`Error executing ${action.tool_input.action}:`, error);
    // Send error response
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.send(
        JSON.stringify({
          tool_id: action.tool_id,
          error: `Error executing ${action.tool_input.action}: ${error.message}`,
        })
      );
    }
  }
}

// WebSocket client reference
let wsClient: WebSocket | null = null;

// Initialize WebSocket connection
function initializeWebSocket(): WebSocket {
  // Close the existing connection
  if (wsClient) return wsClient;

  const ws = new WebSocket("ws://localhost:8000/ws");

  ws.addEventListener("open", () => {
    console.log("WebSocket connection established");
  });

  ws.addEventListener("error", (error) => {
    console.error("WebSocket error:", error);
  });

  ws.addEventListener("close", () => {
    wsClient = null;
    console.log("WebSocket connection closed, attempting to reconnect...");
    setTimeout(() => {
      wsClient = initializeWebSocket();
    }, 3000);
  });

  ws.addEventListener("message", (data) => {
    // Extract the actual data from the MessageEvent
    const cleanedResponse = parseResponse(data.data);

    if (typeof cleanedResponse === "string") {
      // Send assistant progress message to renderer
      const assistantMessage: AgentMessage = {
        type: "assistant-progress",
        content: cleanedResponse,
        timestamp: Date.now(),
      };
      sendProgressUpdate(assistantMessage);
    } else if (cleanedResponse.action === "tool_call") {
      executeAction(cleanedResponse);
    }
  });

  return ws;
}

// Resize the window with animation effect
function animateWindowResize(
  window: BrowserWindow,
  targetHeight: number,
  targetWidth: number,
  duration = 500
): void {
  const startHeight = window.getSize()[1];
  const startWidth = window.getSize()[0];
  const heightDiff = targetHeight - startHeight;
  const widthDiff = targetWidth - startWidth;
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Use a smoother cubic bezier easing function
    const easeProgress = cubicBezier(0.25, 0.1, 0.25, 1.0, progress);

    const currentHeight = startHeight + heightDiff * easeProgress;
    const currentWidth = startWidth + widthDiff * easeProgress;
    window.setSize(Math.round(currentWidth), Math.round(currentHeight));

    if (progress < 1) {
      setTimeout(animate, 8); // ~120fps for smoother animation
    }
  };

  animate();
}

// Function to move window to center bottom of the screen with animation
function moveWindowToCenterBottom(
  window: BrowserWindow,
  contentHeight: number,
  animate = true
): void {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: displayWidth, height: displayHeight } =
    primaryDisplay.workAreaSize;

  // Calculate window dimensions and position
  const windowWidth = window.getSize()[0];
  const windowX = Math.floor((displayWidth - windowWidth) / 2); // Center horizontally
  const windowY = displayHeight - contentHeight; // Bottom of screen with 20px margin

  if (animate) {
    // Then animate the position change
    const startPosition = window.getPosition();
    const startX = startPosition[0];
    const startY = startPosition[1];
    const xDiff = windowX - startX;
    const yDiff = windowY - startY;
    const duration = 600; // Longer duration for smoother movement
    const startTime = Date.now();

    const animatePosition = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use a smoother cubic bezier easing function
      const easeProgress = cubicBezier(0.25, 0.1, 0.25, 1.0, progress);

      const currentX = startX + xDiff * easeProgress;
      const currentY = startY + yDiff * easeProgress;
      window.setPosition(Math.round(currentX), Math.round(currentY));

      if (progress < 1) {
        setTimeout(animatePosition, 16); // ~60fps for smoother animation
      }
    };

    setTimeout(animatePosition, 150); // Slightly longer delay before position change
  } else {
    // No animation, just set size and position directly
    window.setSize(windowWidth, contentHeight);
    window.setPosition(windowX, windowY);
  }
}

// Function to move window back to top center without resizing
function moveWindowToTopCenter(window: BrowserWindow): void {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: displayWidth, height: displayHeight } =
    primaryDisplay.workAreaSize;

  const windowWidth = window.getSize()[0];
  const windowX = Math.floor((displayWidth - windowWidth) / 2); // Center horizontally
  const windowY = Math.floor(displayHeight * 0.3); // Place at 30% from the top (original position)

  // Animate the window back to original position while keeping height
  const startPosition = window.getPosition();
  const startX = startPosition[0];
  const startY = startPosition[1];
  const xDiff = windowX - startX;
  const yDiff = windowY - startY;
  const duration = 600; // Longer duration for smoother movement
  const startTime = Date.now();

  const animatePosition = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Use a smoother cubic bezier easing function
    const easeProgress = cubicBezier(0.25, 0.1, 0.25, 1.0, progress);

    const currentX = startX + xDiff * easeProgress;
    const currentY = startY + yDiff * easeProgress;
    window.setPosition(Math.round(currentX), Math.round(currentY));

    if (progress < 1) {
      setTimeout(animatePosition, 16); // ~60fps for smoother animation
    }
  };

  animatePosition();
}

// Cubic bezier easing function for smoother animations
// This implements the standard CSS ease timing function
function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number
): number {
  // Calculate the coefficients
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  // Use Newton-Raphson method to find t for given x
  function solveCubicBezierX(x: number): number {
    let t = x;
    // Newton-Raphson iteration
    for (let i = 0; i < 5; i++) {
      // Usually 5 iterations is enough
      const currentX = ((ax * t + bx) * t + cx) * t;
      const currentSlope = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(currentSlope) < 1e-6) break;
      t -= (currentX - x) / currentSlope;
    }
    return t;
  }

  // Get t value for the input progress and return the y value
  const tValue = solveCubicBezierX(t);
  return ((ay * tValue + by) * tValue + cy) * tValue;
}

function parseResponse(responseText: string): string | AgentAction {
  try {
    const json = JSON.parse(responseText);
    return json;
  } catch (error) {
    return responseText;
  }
}
export function setupQueryHandler(): void {
  // Initialize WebSocket connection
  wsClient = initializeWebSocket();

  // Set up the main query handler
  ipcMain.handle("handleQuery", async (event, query) => {
    // Get the window from the event
    const window = BrowserWindow.fromWebContents(event.sender);

    // Send user input message to renderer
    const userInputMessage: AgentMessage = {
      type: "user-input",
      content: query,
      timestamp: Date.now(),
    };
    sendProgressUpdate(userInputMessage);

    // Move the window to the center bottom when input is received
    if (window) {
      moveWindowToCenterBottom(window, EXPANDED_MAIN_WINDOW_HEIGHT);
    }

    // Send query to WebSocket server
    wsClient.send(JSON.stringify({ query }));
  });

  // Set up handler to reset window position
  ipcMain.handle("resetWindowPosition", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return { success: false, error: "Window not found" };

    moveWindowToTopCenter(window);

    return { success: true };
  });

  ipcMain.handle("expandWindow", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return { success: false, error: "Window not found" };
    animateWindowResize(
      window,
      EXPANDED_MAIN_WINDOW_HEIGHT,
      EXPANDED_MAIN_WINDOW_WIDTH
    );

    return { success: true };
  });

  // Set up the resize window handler
  ipcMain.handle("minimizeWindow", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return { success: false, error: "Window not found" };
    animateWindowResize(window, MAIN_WINDOW_HEIGHT, MAIN_WINDOW_WIDTH);

    return { success: true };
  });
}
