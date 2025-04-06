import { ipcMain, BrowserWindow } from 'electron';
import { mouse, Point, straightTo, Button, keyboard, Key } from "@nut-tree-fork/nut-js";

// Action type enum
export enum ActionType {
    MOUSE_MOVE = 'mouse_move',
    MOUSE_CLICK = 'mouse_click',
    MOUSE_DRAG = 'mouse_drag',
    KEYBOARD_TYPE = 'keyboard_type',
    KEYBOARD_PRESS = 'keyboard_press'
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
    button: 'left' | 'right' | 'middle';
    doubleClick?: boolean;
}

// Mouse drag action
export interface MouseDragAction extends Action {
    type: ActionType.MOUSE_DRAG;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    button: 'left' | 'right' | 'middle';
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
    type: 'user-input' | 'action-progress';
    content: string;
    timestamp: number;
    actionDetails?: AgentAction;
}

// Union type of all possible actions
export type AgentAction = MouseMoveAction | MouseClickAction | MouseDragAction | KeyboardTypeAction | KeyboardPressAction;

// Function to simulate an SSE response with a series of actions
function simulateSSEResponse(): AgentAction[] {
    return [
        {
            type: ActionType.MOUSE_MOVE,
            x: 500,
            y: 300
        }
    ];
}

// Helper function to send progress updates to the renderer
function sendProgressUpdate(message: ProgressMessage): void {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
        windows[0].webContents.send('agent-progress', message);
    }
}

// Helper function to format action details for human-readable output
function formatActionDetails(action: AgentAction): string {
    switch (action.type) {
        case ActionType.MOUSE_MOVE:
            return `Moving mouse to position (${action.x}, ${action.y})`;
        
        case ActionType.MOUSE_CLICK:
            return `Clicking ${action.button} button at position (${action.x}, ${action.y})${action.doubleClick ? ' (double-click)' : ''}`;
        
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
        type: 'action-progress',
        content: formatActionDetails(action),
        timestamp: Date.now(),
        actionDetails: action
    };
    sendProgressUpdate(progressMessage);
    
    console.log(`Executing action: ${action.type}`);
    
    let button: Button;
    let dragButton: Button;
    const keyMap: {[key: string]: Key} = {
        'Enter': Key.Enter,
        'Tab': Key.Tab,
        'Escape': Key.Escape,
        'Backspace': Key.Backspace,
        'Delete': Key.Delete
    };
    
    switch (action.type) {
        case ActionType.MOUSE_MOVE:
            await mouse.move(straightTo(new Point(action.x, action.y)));
            break;
            
        case ActionType.MOUSE_CLICK:
            // First move to the position
            await mouse.move(straightTo(new Point(action.x, action.y)));
            // Then click
            button = action.button === 'left' ? Button.LEFT : 
                   action.button === 'right' ? Button.RIGHT : Button.MIDDLE;
            
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
            dragButton = action.button === 'left' ? Button.LEFT : 
                        action.button === 'right' ? Button.RIGHT : Button.MIDDLE;
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
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

// Resize the window with animation effect
function animateWindowResize(window: BrowserWindow, targetHeight: number, duration = 300): void {
    const startHeight = window.getSize()[1];
    const heightDiff = targetHeight - startHeight;
    const startTime = Date.now();
    
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Use easeInOutQuad easing function for smooth animation
        const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        
        const currentHeight = startHeight + heightDiff * easeProgress;
        window.setSize(window.getSize()[0], Math.round(currentHeight));
        
        if (progress < 1) {
            setTimeout(animate, 10);
        }
    };
    
    animate();
}

export function setupQueryHandler(): void {
    // Set up the main query handler
    ipcMain.handle('handleQuery', async (event, query) => {
        console.log('Query received:', query);
        
        // Send user input message to renderer
        const userInputMessage: ProgressMessage = {
            type: 'user-input',
            content: query,
            timestamp: Date.now()
        };
        sendProgressUpdate(userInputMessage);
        
        // Get actions from simulated SSE
        const actions = simulateSSEResponse();
        
        // Execute all actions
        await executeActions(actions);
        
        return { success: true, actionsPerformed: actions.length };
    });
    
    // Set up the resize window handler
    ipcMain.handle('resizeWindow', (event, options: { height: number, animated: boolean }) => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) return { success: false, error: 'Window not found' };
        
        const currentWidth = window.getSize()[0];
        
        if (options.animated) {
            animateWindowResize(window, options.height);
        } else {
            window.setSize(currentWidth, options.height);
        }
        
        return { success: true };
    });
} 