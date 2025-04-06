import { ipcMain, BrowserWindow, screen } from "electron";
import {
  mouse,
  Point,
  straightTo,
  Button,
  keyboard,
  Key,
} from "@nut-tree-fork/nut-js";
import {
  EXPANDED_MAIN_WINDOW_HEIGHT,
  EXPANDED_MAIN_WINDOW_WIDTH,
  MAIN_WINDOW_HEIGHT,
  MAIN_WINDOW_WIDTH,
} from "./main";

// Action type enum
export enum ActionType {
  MOUSE_MOVE = "mouse_move",
  MOUSE_CLICK = "mouse_click",
  MOUSE_DRAG = "mouse_drag",
  KEYBOARD_TYPE = "keyboard_type",
  KEYBOARD_PRESS = "keyboard_press",
}

// Base interface for all actions
export interface Action {
  type: ActionType;
}

// Mouse movement action
export interface MouseMoveAction extends Action {
  type: ActionType.MOUSE_MOVE;
  x: number;
  y: number;
}

// Mouse click action
export interface MouseClickAction extends Action {
  type: ActionType.MOUSE_CLICK;
  x: number;
  y: number;
  button: "left" | "right" | "middle";
  doubleClick?: boolean;
}

// Mouse drag action
export interface MouseDragAction extends Action {
  type: ActionType.MOUSE_DRAG;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  button: "left" | "right" | "middle";
}

// Keyboard type action (for typing text)
export interface KeyboardTypeAction extends Action {
  type: ActionType.KEYBOARD_TYPE;
  text: string;
}

// Keyboard press action (for special keys)
export interface KeyboardPressAction extends Action {
  type: ActionType.KEYBOARD_PRESS;
  key: string;
}

// Message type for progress updates
export interface ProgressMessage {
  type: "user-input" | "action-progress";
  content: string;
  timestamp: number;
  actionDetails?: AgentAction;
}

// Union type of all possible actions
export type AgentAction =
  | MouseMoveAction
  | MouseClickAction
  | MouseDragAction
  | KeyboardTypeAction
  | KeyboardPressAction;

// Function to simulate an SSE response with a series of actions
function simulateSSEResponse(): AgentAction[] {
  return [
    {
      type: ActionType.MOUSE_MOVE,
      x: 500,
      y: 300,
    },
    {
      type: ActionType.MOUSE_MOVE,
      x: 100,
      y: 100,
    },
    {
      type: ActionType.MOUSE_MOVE,
      x: 200,
      y: 200,
    },
    {
      type: ActionType.MOUSE_MOVE,
      x: 300,
      y: 300,
    },
    {
      type: ActionType.MOUSE_MOVE,
      x: 400,
      y: 500,
    },
  ];
}

// Helper function to send progress updates to the renderer
function sendProgressUpdate(message: ProgressMessage): void {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    windows[0].webContents.send("agent-progress", message);
  }
}

// Helper function to format action details for human-readable output
function formatActionDetails(action: AgentAction): string {
  switch (action.type) {
    case ActionType.MOUSE_MOVE:
      return `Moving mouse to position (${action.x}, ${action.y})`;

    case ActionType.MOUSE_CLICK:
      return `Clicking ${action.button} button at position (${action.x}, ${
        action.y
      })${action.doubleClick ? " (double-click)" : ""}`;

    case ActionType.MOUSE_DRAG:
      return `Dragging with ${action.button} button from (${action.startX}, ${action.startY}) to (${action.endX}, ${action.endY})`;

    case ActionType.KEYBOARD_TYPE:
      return `Typing text: "${action.text}"`;

    case ActionType.KEYBOARD_PRESS:
      return `Pressing key: ${action.key}`;

    default:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return `Unknown action: ${(action as any).type}`;
  }
}

// Execute a single action
async function executeAction(action: AgentAction): Promise<void> {
  // Send progress update to renderer
  const progressMessage: ProgressMessage = {
    type: "action-progress",
    content: formatActionDetails(action),
    timestamp: Date.now(),
    actionDetails: action,
  };
  sendProgressUpdate(progressMessage);

  let button: Button;
  let dragButton: Button;
  const keyMap: { [key: string]: Key } = {
    Enter: Key.Enter,
    Tab: Key.Tab,
    Escape: Key.Escape,
    Backspace: Key.Backspace,
    Delete: Key.Delete,
  };

  switch (action.type) {
    case ActionType.MOUSE_MOVE:
      await mouse.move(straightTo(new Point(action.x, action.y)));
      break;

    case ActionType.MOUSE_CLICK:
      // First move to the position
      await mouse.move(straightTo(new Point(action.x, action.y)));
      // Then click
      button =
        action.button === "left"
          ? Button.LEFT
          : action.button === "right"
          ? Button.RIGHT
          : Button.MIDDLE;

      if (action.doubleClick) {
        await mouse.doubleClick(button);
      } else {
        await mouse.click(button);
      }
      break;

    case ActionType.MOUSE_DRAG:
      // Move to start position
      await mouse.move(straightTo(new Point(action.startX, action.startY)));
      // Press down
      dragButton =
        action.button === "left"
          ? Button.LEFT
          : action.button === "right"
          ? Button.RIGHT
          : Button.MIDDLE;
      await mouse.pressButton(dragButton);
      // Move to end position
      await mouse.move(straightTo(new Point(action.endX, action.endY)));
      // Release button
      await mouse.releaseButton(dragButton);
      break;

    case ActionType.KEYBOARD_TYPE:
      await keyboard.type(action.text);
      break;

    case ActionType.KEYBOARD_PRESS:
      // Map string key name to Key enum if needed
      if (action.key in keyMap) {
        await keyboard.pressKey(keyMap[action.key]);
        await keyboard.releaseKey(keyMap[action.key]);
      } else {
        console.warn(`Unsupported key: ${action.key}`);
      }
      break;

    default:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.warn(`Unknown action type: ${(action as any).type}`);
  }
}

// Execute a series of actions
async function executeActions(actions: AgentAction[]): Promise<void> {
  for (const action of actions) {
    await executeAction(action);
    // Add a small delay between actions
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
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

export function setupQueryHandler(): void {
  // Set up the main query handler
  ipcMain.handle("handleQuery", async (event, query) => {
    // Get the window from the event
    const window = BrowserWindow.fromWebContents(event.sender);

    // Send user input message to renderer
    const userInputMessage: ProgressMessage = {
      type: "user-input",
      content: query,
      timestamp: Date.now(),
    };
    sendProgressUpdate(userInputMessage);

    // Get actions from simulated SSE
    const actions = simulateSSEResponse();

    // Move the window to the center bottom when input is received
    if (window) {
      moveWindowToCenterBottom(window, EXPANDED_MAIN_WINDOW_HEIGHT);
    }

    // Execute all actions
    await executeActions(actions);

    // After actions are complete, move window back to the top center position
    // but keep it expanded if it has messages
    if (window) {
      // Only move the window back to top center, don't resize
      moveWindowToTopCenter(window);
    }

    return { success: true, actionsPerformed: actions.length };
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
