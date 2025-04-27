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
import { httpStartRecord, httpStopRecord } from "./api";

const WINDOW_MODES = {
  initial: {
    // height: 60,
    width: 200,
  },
  recording: {
    // height: 300,
    width: 70,
  },
  minimized: {
    // height: 32,
    width: 250,
  },
};

const dummy_events = [
  '{"action":"connection_status","client_id":"127.0.0.1:65315","status":"connected","debug_mode":false}',
  "I'll help you move the mouse towards a \"main.ts\" file. First, I should take a screenshot to see what's currently on the screen, then look for the main.ts file before moving the mouse towards it.",
  '{"action":"tool_call","tool_name":"computer","tool_type":"computer","tool_input":{"action":"screenshot"},"tool_id":"toolu_01XDsRrsxqmGMdC9BdQXDYDA"}',
  "Tool Output: Screenshot saved to /Users/just_mukul/Desktop/Other/general-agent/gen-agent/screenshots/screenshot-2025-04-18T16-43-48.967Z.png",
  'I can see the screen shows an Electron application with a file explorer panel on the left side. In this panel, I can see "main.ts" file listed under the project files. I\'ll now move the mouse towards this main.ts file.',
  '{"action":"tool_call","tool_name":"computer","tool_type":"computer","tool_input":{"action":"mouse_move","coordinate":[77,397]},"tool_id":"toolu_018yCvJLsrVw4chx7RP9xC11"}',
  "Tool Output: Screenshot saved to /Users/just_mukul/Desktop/Other/general-agent/gen-agent/screenshots/screenshot-2025-04-18T16-43-48.967Z.png",
  "The mouse has been moved to the coordinates where main.ts is located in the file explorer. Let me know if you would like me to click on it or perform any other actions.",
  "I've successfully moved the mouse to the position of the main.ts file in the file explorer. The system has confirmed that the mouse movement action was completed successfully.\n\nIs there anything else you'd like me to do with the main.ts file, such as clicking on it to open it, or would you like me to perform any other actions?",
  '{"action":"request_complete"}',
];

// Target dimensions for scaled screenshots (matching Python's FWXGA target)
const TARGET_DIMENSIONS = {
  width: 1366,
  height: 768,
};

// Flag to enable/disable coordinate scaling
const SCALING_ENABLED = true;

// Flag to use dummy events instead of real websocket
const USE_DUMMY_EVENTS = false;
let currentDummyEventIndex = 0;

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
  const { width, height } = primaryDisplay.size;

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
        quality: "best",
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
  // If using dummy events, return a mock WebSocket
  if (USE_DUMMY_EVENTS) {
    // Create a mock WebSocket object
    const mockWs = {
      readyState: 1, // WebSocket.OPEN
      send: () => {
        console.log("Mock WebSocket received:");
        // No actual sending happens here
      },
      addEventListener: (event: string) => {
        console.log(`Mock WebSocket would add listener for: ${event}`);
        // No actual event binding happens here
      },
      close: () => {
        console.log("Mock WebSocket closed");
        // No actual closing happens here
      },
    } as unknown as WebSocket;

    return mockWs;
  }

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
    } else if (cleanedResponse.action === "request_complete") {
      sendProgressUpdate({
        type: "request-complete",
        content: "Request complete",
        timestamp: Date.now(),
      });
    }
  });

  return ws;
}

// Function to move window to center bottom of the screen with animation
function toggleWindowMode(
  window: BrowserWindow,
  mode: "initial" | "recording" | "minimized",
  height: number,
  width?: number
): void {
  console.log("toggleWindowMode", mode, height, width);
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: displayWidth, height: displayHeight } =
    primaryDisplay.workAreaSize;

  // Calculate window dimensions and position
  let windowX, windowY;
  width = width || WINDOW_MODES[mode].width;

  if (mode === "minimized" || mode === "recording") {
    // Top right for minimized mode
    windowX = displayWidth - width - 20; // Right side with margin
    windowY = 60; // Top with margin
  } else {
    // Center bottom for initial and expanded modes
    windowX = Math.floor((displayWidth - width) / 2); // Center horizontally
    windowY = displayHeight - height - 40; // Bottom of screen
  }

  // No animation, just set size and position directly
  window.setSize(width, height);
  window.setPosition(windowX, windowY);
}

function parseResponse(responseText: string): string | AgentAction {
  try {
    const json = JSON.parse(responseText);
    return json;
  } catch (error) {
    return responseText.trim();
  }
}

// Function to process the next dummy event
function processNextDummyEvent() {
  if (!USE_DUMMY_EVENTS || currentDummyEventIndex >= dummy_events.length) {
    return;
  }

  const event = dummy_events[currentDummyEventIndex++];

  const cleanedResponse = parseResponse(event);

  if (typeof cleanedResponse === "string") {
    if (!cleanedResponse.includes("Tool Output:")) {
      // Send assistant progress message to renderer
      const assistantMessage: AgentMessage = {
        type: "assistant-progress",
        content: cleanedResponse,
        timestamp: Date.now(),
      };
      sendProgressUpdate(assistantMessage);
    }
  } else if (cleanedResponse.action === "tool_call") {
    executeAction(cleanedResponse);
  } else if (cleanedResponse.action === "request_complete") {
    sendProgressUpdate({
      type: "request-complete",
      content: "Request complete",
      timestamp: Date.now(),
    });
  }

  // Schedule the next event with a delay to simulate realistic timing
  if (currentDummyEventIndex < dummy_events.length) {
    setTimeout(processNextDummyEvent, 1000);
  }
}

export function setupQueryHandler(): void {
  // Initialize WebSocket connection
  wsClient = initializeWebSocket();

  // Set up the main query handler
  ipcMain.handle("handleQuery", async (event, query) => {
    // Send user input message to renderer
    const userInputMessage: AgentMessage = {
      type: "user-input",
      content: query,
      timestamp: Date.now(),
    };
    sendProgressUpdate(userInputMessage);

    if (USE_DUMMY_EVENTS) {
      // Reset the dummy event index and start processing events
      currentDummyEventIndex = 0;
      processNextDummyEvent();
    } else {
      // Send query to WebSocket server (original behavior)
      wsClient.send(JSON.stringify({ query }));
    }
  });

  ipcMain.handle("startRecording", async () => {
    try {
      // Make HTTP POST request to start recording
      const response = await httpStartRecord();
      if (!response.ok) {
        throw new Error(`Failed to start recording: ${response.statusText}`);
      }

      console.log("Recording started successfully");
      return { success: true };
    } catch (error) {
      console.error("Error starting recording:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("stopRecording", async () => {
    try {
      const response = await httpStopRecord();
      if (!response.ok) {
        throw new Error(`Failed to stop recording: ${response.statusText}`);
      }

      console.log("Recording stopped successfully");
      return { success: true };
    } catch (error) {
      console.error("Error stopping recording:", error);
      return { success: false, error: error.message };
    }
  });
}
