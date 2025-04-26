type AgentMessageType =
  | "user-input"
  | "action-progress"
  | "assistant-progress"
  | "action-error"
  | "request-complete";

type AgentToolAction =
  // Press a key or key-combination on the keyboard.
  | "key"
  // Hold down a key or multiple keys for a specified duration (in seconds).
  | "hold_key"
  // Type a string of text on the keyboard.
  | "type"
  // Get the current (x, y) pixel coordinate of the cursor on the screen.
  | "cursor_position"
  // Move the cursor to a specified (x, y) pixel coordinate on the screen.
  | "mouse_move"
  // Press the left mouse button.
  | "left_mouse_down"
  // Release the left mouse button.
  | "left_mouse_up"
  // Click the left mouse button at the specified (x, y) pixel coordinate on the screen.
  | "left_click"
  // Click and drag the cursor from `start_coordinate` to a specified (x, y) pixel coordinate on the screen.
  | "left_click_drag"
  // Click the right mouse button at the specified (x, y) pixel coordinate on the screen.
  | "right_click"
  // Click the middle mouse button at the specified (x, y) pixel coordinate on the screen.
  | "middle_click"
  // Double-click the left mouse button at the specified (x, y) pixel coordinate on the screen.
  | "double_click"
  // Triple-click the left mouse button at the specified (x, y) pixel coordinate on the screen.
  | "triple_click"
  // Scroll the screen in a specified direction by a specified amount of clicks of the scroll wheel, at the specified (x, y) pixel coordinate. DO NOT use PageUp/PageDown to scroll.
  | "scroll"
  // Wait for a specified duration (in seconds).
  | "wait"
  // Take a screenshot of the screen.
  | "screenshot";

type AgentActionType = "tool_call";

type AgentToolType = "computer";

interface AgentToolInput {
  action: AgentToolAction;
  // (x, y): The x (pixels from the left edge) and y (pixels from the top edge) coordinates to move the mouse to. Required only by `action=mouse_move` and `action=left_click_drag`
  coordinate?: number[];
  // The duration to hold the key down for. Required only by `action=hold_key` and `action=wait`
  duration?: number;
  // The number of 'clicks' to scroll. Required only by `action=scroll`
  scroll_amount?: number;
  // The direction to scroll the screen. Required only by `action=scroll`
  scroll_direction?: "up" | "down" | "left" | "right";
  // (x, y): The x (pixels from the left edge) and y (pixels from the top edge) coordinates to start the drag from. Required only by `action=left_click_drag`
  start_coordinate?: number[];
  // Required only by `action=type`, `action=key`, and `action=hold_key`. Can also be used by click or scroll actions to hold down keys while clicking or scrolling.
  text?: string;
}

interface AgentAction {
  action: AgentActionType;
  tool_name: string;
  tool_type: AgentToolType;
  tool_input: AgentToolInput;
  tool_id: string;
}

interface AgentMessage {
  type: AgentMessageType;
  content: string;
  timestamp: number;
  actionDetails?: AgentAction;
}

interface Workflow {
  Title: string;
  Steps: string[];
  "Important Input Text Fields": string[];
}

interface Window {
  electronAPI: {
    handleQuery: (
      query: string
    ) => Promise<{ success: boolean; actionsPerformed?: number }>;
    onAgentProgress: (callback: (message: AgentMessage) => void) => () => void;
    toggleWindowMode: (data: {
      mode: "initial" | "recording" | "minimized";
      height: number;
      width?: number;
    }) => Promise<{ success: boolean; error?: string }>;
    startRecording: () => Promise<{ success: boolean; error?: string }>;
    stopRecording: () => Promise<{ success: boolean; error?: string }>;
  };
}
