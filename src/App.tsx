import { useEffect, useRef, useState } from "react";
import { PlayCircle, Mic, Loader2, ArrowUp, Square, User, Wrench, Radio, Repeat, CircleDot, ScreenShare, ScreenShareOff, MousePointerClick, Play } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import ReactMarkdown from 'react-markdown';
import { getWorkflows } from "./api";

const INITIAL_WINDOW_HEIGHT = 40; // Keep this as the base/recording height
const MAX_WINDOW_HEIGHT = 350; 
const INITIAL_WINDOW_WIDTH = 400;
// const MAX_WINDOW_WIDTH = 600; // Max width before horizontal scroll (Optional)
const MINIMIZED_DEFAULT_WIDTH = 350;
const MINIMIZED_WINDOW_HEIGHT = 32;
const RECORDING_WINDOW_WIDTH = 130; // Tighter width, just for the button
const RECORDING_WINDOW_HEIGHT = INITIAL_WINDOW_HEIGHT; // Match initial height
const PLAY_WINDOW_WIDTH = 300;
const PLAY_WINDOW_HEIGHT = 300;
// const HISTORY_AREA_MAX_HEIGHT = MAX_WINDOW_HEIGHT - 60; // No longer needed, calculated dynamically

function App() {
  const removeListenerRef = useRef<(() => void) | null>(null);
  const minimisedDivRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [windowMode, setWindowMode] = useState<{
    mode: "initial" | "recording" | "minimized";
    height: number;
    width: number;
  }>({
    mode: "initial",
    height: INITIAL_WINDOW_HEIGHT,
    width: INITIAL_WINDOW_WIDTH,
  });
  const [workflows, setWorkflows] = useState<{
    show: boolean;
    workflows: Workflow[];
    loading: boolean;
  }>({
    show: false,
    workflows: [],
    loading: false,
  });
  const historyScrollAreaRef = useRef<HTMLDivElement>(null);
  const commandBarRef = useRef<HTMLDivElement>(null);

  const isRecording = windowMode.mode === "recording";

  const cleanToolAction = (action: string) => {
    if (!action) return;
    return action
      .replace("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const latestMessage = messages[messages.length - 1];
  const isToolAction =
    latestMessage?.actionDetails?.tool_input.action ||
    latestMessage?.actionDetails?.action;

  // Focus input when app loads
  useEffect(() => {
    if (chatInputRef.current && windowMode.mode === 'initial') {
      chatInputRef.current.focus();
    }
  }, [windowMode.mode]);

  useEffect(() => {
    const removeListener = window.electronAPI.onAgentProgress(
      (message: AgentMessage) => {
        if (message.type === "request-complete") {
          setWindowMode({
            mode: "initial",
            height: INITIAL_WINDOW_HEIGHT,
            width: INITIAL_WINDOW_WIDTH,
          });
        } else {
          setMessages((prevMessages) => [...prevMessages, message]);
        }
      }
    );

    removeListenerRef.current = removeListener;

    return () => {
      if (removeListenerRef.current) {
        removeListenerRef.current();
      }
    };
  }, []);

  // Handle transition TO minimized mode
  useEffect(() => {
    if (messages.length > 0 && latestMessage && windowMode.mode !== 'minimized') {
      const targetWidth = MINIMIZED_DEFAULT_WIDTH;
      // Use a predictable height initially for minimized mode
      setWindowMode({
        mode: "minimized",
        height: MINIMIZED_WINDOW_HEIGHT + 16, // Base content height + padding
        width: targetWidth,
      });
    } else if (messages.length === 0 && windowMode.mode !== 'initial') {
      // Transition back to initial if messages are cleared (e.g., new session)
      setWindowMode({
        mode: "initial",
        height: INITIAL_WINDOW_HEIGHT, // Base height
        width: INITIAL_WINDOW_WIDTH,
      });
    }
    // Removed windowMode.mode dependency to prevent loops on state change within this effect
  }, [messages, latestMessage]); 

  // Update window size when mode/height/width state changes
  useEffect(() => {
    window.electronAPI.toggleWindowMode({
      mode: windowMode.mode,
      height: windowMode.height,
      width: windowMode.width,
    });
  }, [windowMode]);

  // Auto-resize textarea height based on content (for initial mode command bar)
  useEffect(() => {
    if (chatInputRef.current && windowMode.mode === 'initial') {
      // Apply resize logic to textarea
      chatInputRef.current.style.height = 'auto';
      const scrollHeight = chatInputRef.current.scrollHeight;
      // Max height relative to overall window max height, leaving space
      const maxTextareaHeight = Math.max(26, MAX_WINDOW_HEIGHT * 0.4); 
      const newTextareaHeight = Math.min(scrollHeight, maxTextareaHeight);
      chatInputRef.current.style.height = `${newTextareaHeight}px`;
    }
    // Dependency on chatInput only, let window resize be handled separately
  }, [chatInput, windowMode.mode]); 

  // Effect to resize INITIAL window based on history + command bar content height
  useEffect(() => {
    if (windowMode.mode === 'initial' && !workflows.show) {
      const historyHeight = historyScrollAreaRef.current?.scrollHeight || 0;
      const commandBarHeight = commandBarRef.current?.offsetHeight || 38; // Get actual or default
      const requiredHeight = Math.min(MAX_WINDOW_HEIGHT, historyHeight + commandBarHeight);
      
      if (requiredHeight > 0 && requiredHeight !== windowMode.height) {
        setWindowMode(prev => ({ ...prev, height: requiredHeight }));
      }
    }
    // Rerun when messages change (affects history) or chat input changes (affects command bar)
  }, [messages, chatInput, windowMode.mode, workflows.show]);

  // Effect to resize MINIMIZED window based on actual rendered content height
  useEffect(() => {
    if (windowMode.mode === 'minimized' && minimisedDivRef.current) {
        const requiredHeight = Math.min(MAX_WINDOW_HEIGHT, minimisedDivRef.current.scrollHeight + 16);
        if (requiredHeight !== windowMode.height) {
          setWindowMode(prev => ({ ...prev, height: requiredHeight }));
        }
    }
    // Keep original dependencies
  }, [latestMessage, windowMode.mode]); 

  const startRecording = () => {
    setWorkflows({
      ...workflows,
      show: false,
    });
    setWindowMode({
      ...windowMode,
      mode: "recording",
      height: RECORDING_WINDOW_HEIGHT,
      width: RECORDING_WINDOW_WIDTH,
    });
    window.electronAPI.startRecording();
  };

  const stopRecording = () => {
    setWindowMode({
      mode: "initial",
      height: INITIAL_WINDOW_HEIGHT,
      width: INITIAL_WINDOW_WIDTH,
    });
    window.electronAPI.stopRecording();
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    window.electronAPI.handleQuery(chatInput);
    setChatInput("");
    // Don't immediately switch to minimized here, let the message effect handle it
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      setChatInput((prev) => prev + '\n');
    } 
    else if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const reloadWorkflows = async () => {
    setWorkflows({
      ...workflows,
      loading: true,
      show: true
    });
    try {
      const response = await getWorkflows();
      if (!response.ok) throw new Error('Failed to fetch workflows');
      const parsedResponse = await response.json();
      setWorkflows({
        ...workflows,
        workflows: parsedResponse.workflows || [],
        loading: false,
        show: true
      });
    } catch (error) {
        console.error("Error loading workflows:", error);
        setWorkflows({ show: true, workflows: [], loading: false }); // Show empty state on error
    }
  };

  const toggleWorkflowList = () => {
    if (!workflows.show) {
      setWindowMode({
        mode: "initial", // Keep mode as initial when showing workflows
        width: PLAY_WINDOW_WIDTH,
        height: PLAY_WINDOW_HEIGHT,
      });
      reloadWorkflows();
    } else {
      setWorkflows({
        ...workflows,
        show: false,
      });
      // Return to previous initial state dimensions
      setWindowMode({
        mode: "initial",
        width: INITIAL_WINDOW_WIDTH,
        height: INITIAL_WINDOW_HEIGHT, // Or potentially restore dynamic height? Start simple.
      });
    }
  };

  const selectWorkflow = (index: number) => {
    setWorkflows({
      ...workflows,
      show: false,
    });
    run_workflow(workflows.workflows[index]);
  };

  const run_workflow = (workflow: Workflow) => {
    window.electronAPI.handleQuery(workflow.Steps.join("\n"));
    // Let the message effect handle the transition to minimized
  };

  // Function to reset state to initial
  const goBackToInitial = () => {
    console.log("Stop requested, resetting UI to initial state.");
    setChatInput(""); 
    // Trigger recalculation of initial height
    setWindowMode(prev => ({
      ...prev, // Keep existing width potentially
      mode: "initial",
      height: INITIAL_WINDOW_HEIGHT, // Set base, effect will adjust
      width: INITIAL_WINDOW_WIDTH // Reset width too
    }));
  };

  // Conditional rendering for initial view
  if (windowMode.mode === 'initial' && !workflows.show) {
    return (
      <div className="app-container-initial draggable">
        {messages.length > 0 && (
          <ScrollArea ref={historyScrollAreaRef} className="history-area non-draggable">
            <div className="history-content">
              {messages.map((message, idx) => {
                let typeClass = 'agent';
                let IconComponent = null; // Variable to hold the icon

                if (message.type === 'user-input') {
                  typeClass = 'user';
                  IconComponent = User; // Assign User icon
                } else if (message.type === 'action-progress') {
                  typeClass = 'tool';
                  IconComponent = Wrench; // Assign Wrench icon
                } else if (message.type === 'action-error') {
                  typeClass = 'error';
                  // Maybe add an error icon later like AlertTriangle?
                }
                
                if (message.type === 'request-complete') return null;

                return (
                  // Add flex layout to message container
                  <div key={idx} className={`history-message ${typeClass}`}>
                    {/* Icon container */} 
                    {IconComponent && (
                      <div className="history-icon-container">
                        <IconComponent size={14} />
                      </div>
                    )}
                    {/* Message Content Area */} 
                    <div className="history-message-content">
                      {message.type === 'user-input' ? (
                        <pre>{message.content}</pre> 
                      ) : (
                        <ReactMarkdown 
                          allowedElements={['p', 'strong', 'em', 'code', 'a', 'br']}
                          unwrapDisallowed={true}
                        >
                          {message.content} 
                        </ReactMarkdown>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        )}

        <div ref={commandBarRef} className="command-bar non-draggable" style={{ minHeight: '38px' }}>
             <div className="action-buttons">
               <button className="action-button record" onClick={startRecording} title="Record Actions">
                 <ScreenShare size={14} />
               </button>
               <button className="action-button replay" onClick={toggleWorkflowList} title="Replay Workflow">
                 <MousePointerClick size={14} />
               </button>
             </div>
             <div className="input-container">
               <textarea
                 ref={chatInputRef}
                 value={chatInput}
                 onChange={(e) => setChatInput(e.target.value)}
                 onKeyDown={handleKeyDown}
                 placeholder="Command your computer..."
                 className="command-input"
                 rows={1}
                 autoFocus
               />
               <button 
                 className="send-button" 
                 onClick={handleSendMessage}
                 disabled={!chatInput.trim()}
                 title="Send command (Enter) | New line (Cmd/Ctrl+Enter)"
               >
                 <ArrowUp size={12} />
               </button>
           </div>
         </div>
      </div>
    );
  }

  // Conditional rendering for recording mode 
  if (isRecording) {
    return (
      <div className="app-container-initial draggable"> {/* Match initial container */}
        <div 
          className="command-bar recording-bar non-draggable" 
          style={{ height: `${INITIAL_WINDOW_HEIGHT}px` /* Explicit initial height */ }}
        >
          {/* Centered Stop Button */} 
          <button
            onClick={stopRecording}
            className="stop-recording-button-centered"
            title="Stop Recording"
          >
            <ScreenShareOff size={14} className="mr-1.5"/> 
            Stop Recording
          </button>
        </div>
      </div>
    );
  }

  // Conditional rendering for workflows mode 
  if (workflows.show) {
     return (
         <div className="workflows-container" style={{ height: `${windowMode.height}px` }}>
           <div className="workflows-header">
             <button className="back-button" onClick={toggleWorkflowList}>
               ← Back
             </button>
             <div className="workflows-title">Saved Workflows</div>
           </div>
           
           {workflows.loading ? (
             <div className="workflows-loading">
               <Loader2 className="animate-spin" size={16} />
             </div>
           ) : workflows.workflows.length > 0 ? (
             <ScrollArea className="workflows-list">
               {workflows.workflows.map((workflow, idx) => (
                 <div
                   key={idx}
                   className="workflow-item"
                 >
                   <span className="workflow-item-title">{workflow.Title}</span>
                   <button 
                     className="workflow-run-button" 
                     onClick={(e) => { 
                       e.stopPropagation(); // Prevent row click if any
                       selectWorkflow(idx); 
                     }}
                     title="Run Workflow"
                   >
                     <Play size={14} />
                   </button>
                 </div>
               ))}
             </ScrollArea>
           ) : (
             <div className="workflows-empty">No workflows found.</div>
           )}
         </div>
     );
  }
  
  // Conditional rendering for minimized mode 
  if (windowMode.mode === 'minimized' && latestMessage) {
      const contentToRender = cleanToolAction(isToolAction) || latestMessage.content;
      return (
          <div
            ref={minimisedDivRef} 
            className="minimized-container"
          >
            <div className="activity-indicator"></div>
            <div className="minimized-content" title={contentToRender}>
              <ReactMarkdown
                allowedElements={['p', 'strong', 'em', 'code', 'a', 'br']}
                unwrapDisallowed={true}
              >
                {contentToRender}
              </ReactMarkdown>
            </div>
            {/* Stop Button */} 
            <button 
              className="stop-button" 
              onClick={goBackToInitial} 
              title="Stop Execution & Reset"
            >
              <Square size={12} />
            </button>
          </div>
      );
  }

  // Fallback or loading state if needed
  return null; 

}

export default App;
