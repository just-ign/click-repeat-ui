type AgentActionType =
  | "key"
  | "type"
  | "mouse_move"
  | "left_click"
  | "left_click_drag"
  | "right_click"
  | "middle_click"
  | "double_click"
  | "screenshot"
  | "cursor_position"
  | "left_mouse_down"
  | "left_mouse_up"
  | "scroll"
  | "hold_key"
  | "wait"
  | "triple_click";

type ScrollDirection = "up" | "down" | "left" | "right";

type AgentMessageType = "user-input" | "action-progress";

interface AgentAction {
  action: AgentActionType;
  text: string;
  coordinate?: number[];
  scroll_direction?: ScrollDirection;
  scroll_amount?: number;
  duration?: number;
  key?: string;
}

interface AgentMessage {
  type: AgentMessageType;
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
      callback: (message: AgentMessage) => void
    ) => () => void;
    expandWindow: () => Promise<{ success: boolean; error?: string }>;
    minimizeWindow: () => Promise<{ success: boolean; error?: string }>;
  };
}
