// Type definitions for Electron API

// Action type enum
enum ActionType {
  MOUSE_MOVE = "mouse_move",
  MOUSE_CLICK = "mouse_click",
  MOUSE_DRAG = "mouse_drag",
  KEYBOARD_TYPE = "keyboard_type",
  KEYBOARD_PRESS = "keyboard_press",
}

// Base interface for all actions
interface Action {
  type: ActionType;
}

// Mouse movement action
interface MouseMoveAction extends Action {
  type: ActionType.MOUSE_MOVE;
  x: number;
  y: number;
}

// Mouse click action
interface MouseClickAction extends Action {
  type: ActionType.MOUSE_CLICK;
  x: number;
  y: number;
  button: "left" | "right" | "middle";
  doubleClick?: boolean;
}

// Mouse drag action
interface MouseDragAction extends Action {
  type: ActionType.MOUSE_DRAG;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  button: "left" | "right" | "middle";
}

// Keyboard type action (for typing text)
interface KeyboardTypeAction extends Action {
  type: ActionType.KEYBOARD_TYPE;
  text: string;
}

// Keyboard press action (for special keys)
interface KeyboardPressAction extends Action {
  type: ActionType.KEYBOARD_PRESS;
  key: string;
}

// Union type of all possible actions
type AgentAction =
  | MouseMoveAction
  | MouseClickAction
  | MouseDragAction
  | KeyboardTypeAction
  | KeyboardPressAction;

interface ProgressMessage {
  type: "user-input" | "action-progress";
  content: string;
  timestamp: number;
  actionDetails?: AgentAction;
}

interface Window {
  electronAPI: {
    handleQuery: (
      query: string
    ) => Promise<{ success: boolean; actionsPerformed?: number }>;
    onAgentProgress: (
      callback: (message: ProgressMessage) => void
    ) => () => void;
    expandWindow: () => Promise<{ success: boolean; error?: string }>;
    minimizeWindow: () => Promise<{ success: boolean; error?: string }>;
  };
}
