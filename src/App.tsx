import { useEffect, useRef, useState } from "react";
import { PlayCircle, Mic, Loader2, ArrowUp, Square, User, Wrench, Radio, Repeat, CircleDot, ScreenShare, ScreenShareOff, MousePointerClick, Play, Edit, Paperclip, PlusCircle, Trash2, Save, X, Workflow, Computer, ChevronDown } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import ReactMarkdown from 'react-markdown';
import { getWorkflows } from "./api";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const INITIAL_WINDOW_HEIGHT = 80; // Keep this as the base/recording height
const MAX_WINDOW_HEIGHT = 500; // Increased Max height for dropdowns
const INITIAL_WINDOW_WIDTH = 600; // Reduced width
// const MAX_WINDOW_WIDTH = 600; // Max width before horizontal scroll (Optional)
const MINIMIZED_DEFAULT_WIDTH = 455;
const MINIMIZED_WINDOW_HEIGHT = 42;
const RECORDING_WINDOW_WIDTH = 200; // Further increased width
const RECORDING_WINDOW_HEIGHT = 50; // Match command bar min-height
const PLAY_WINDOW_WIDTH = 300;
const PLAY_WINDOW_HEIGHT = 300;
// const HISTORY_AREA_MAX_HEIGHT = MAX_WINDOW_HEIGHT - 60; // No longer needed, calculated dynamically

// Define structure for Important Input Text Fields
interface ImportantField {
    Field: string;
    Value: string;
}

// Define Workflow type locally to ensure correct structure
interface Workflow {
    Title: string;
    Steps: string[];
    "Important Input Text Fields"?: ImportantField[]; // Use correct name and type
}

// Define AgentMessage type if not already globally defined
// Assume it includes properties used below (type, content, actionDetails)
// interface AgentMessage { ... }

// Placeholder data (replace with actual data source later)
const VMS = ["macos-sequoia-vm-1", "ubuntu-docker-large", "windows-gpu-vm"];
const MODELS = ["claude-3.7-sonnet", "gpt-4o", "gemini-1.5-pro"];

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
    editingWorkflowIndex: number | null;
    editedWorkflow: Workflow | null;
  }>({
    show: false,
    workflows: [],
    loading: false,
    editingWorkflowIndex: null,
    editedWorkflow: null,
  });
  const [attachedWorkflow, setAttachedWorkflow] = useState<Workflow | null>(null);
  // State for VM/Model selection
  const [availableVms, setAvailableVms] = useState<string[]>(VMS);
  const [selectedVm, setSelectedVm] = useState<string>(VMS[0]);
  const [availableModels, setAvailableModels] = useState<string[]>(MODELS);
  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0]);
  const historyScrollAreaRef = useRef<HTMLDivElement>(null);
  const commandBarRef = useRef<HTMLDivElement>(null);

  const isRecording = windowMode.mode === "recording";

  const cleanToolAction = (action: string | undefined) => { // Added undefined check
    if (!action) return;
    return action
      .replace("_", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  // Ensure latestMessage and its properties are checked before access
  const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const isToolAction =
    latestMessage?.actionDetails?.tool_input?.action ||
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
    // Also check that we are not currently editing a workflow, as that view has its own size logic
    if (windowMode.mode === 'initial' && !workflows.show && workflows.editingWorkflowIndex === null) {
      // Recalculate height based on visible elements
      const historyHeight = historyScrollAreaRef.current?.scrollHeight || 0;
      const commandBarHeight = commandBarRef.current?.offsetHeight || 50; // Use a reasonable default if ref not ready
      
      // Calculate required height based on history + command bar (which includes indicator + context bar if present)
      const requiredHeight = Math.min(MAX_WINDOW_HEIGHT, historyHeight + commandBarHeight);
      
      if (requiredHeight > 0 && requiredHeight !== windowMode.height) {
          console.log(`Initial mode resize: history=${historyHeight}, commandBar=${commandBarHeight}, required=${requiredHeight}`); // Debug log
          setWindowMode(prev => ({ ...prev, height: requiredHeight }));
      }
    }
    // Rerun when messages, input, mode, workflows.show, or attachedWorkflow changes
  }, [messages, chatInput, windowMode.mode, workflows.show, attachedWorkflow, workflows.editingWorkflowIndex]);

  // Effect to resize MINIMIZED window based on actual rendered content height
  useEffect(() => {
    if (windowMode.mode === 'minimized' && minimisedDivRef.current) {
      // Debounce the height update
      const timer = setTimeout(() => {
        if (minimisedDivRef.current) { // Check ref again inside timeout
          const requiredHeight = Math.min(MAX_WINDOW_HEIGHT, minimisedDivRef.current.scrollHeight);
          
          // Check current height *inside* timeout to avoid stale closure value
          setWindowMode(prev => {
            if (prev.mode === 'minimized' && requiredHeight !== prev.height) {
               return { ...prev, height: requiredHeight };
            }
            return prev; // No change needed
          });
        }
      }, 50); // Wait 50ms before measuring and updating

      return () => clearTimeout(timer); // Cleanup timeout on unmount or dependency change
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
    const userInstructions = chatInput.trim();

    if (attachedWorkflow) {
        const formattedWorkflow = formatWorkflowForQuery(attachedWorkflow);
        let combinedQuery = formattedWorkflow;

        // Add user instructions section only if there are instructions
        if (userInstructions) {
          // Check if the workflow part ended with ----, if not, add it
          if (!combinedQuery.endsWith("----")) {
             combinedQuery += "\n----"; // Add separator if fields were missing
          }
          combinedQuery += `\nUser instruction:\n${userInstructions}`;
        }

        console.log("Sending combined query:", combinedQuery); // Debug log
        window.electronAPI.handleQuery(combinedQuery);

        setAttachedWorkflow(null); // Clear attached workflow after sending
        setChatInput(""); // Clear chat input

    } else if (userInstructions) {
        // Send only user input if no workflow attached
        // Format as only user instruction
        const queryToSend = `User instruction:\n${userInstructions}`;
        console.log("Sending standard query:", queryToSend);
        window.electronAPI.handleQuery(queryToSend);
        setChatInput(""); // Clear chat input
    }
    // Do nothing if input is empty and no workflow attached
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
      show: true,
      editingWorkflowIndex: null, // Reset editing state on reload
      editedWorkflow: null,
    });
    try {
      const response = await getWorkflows();
      if (!response.ok) throw new Error('Failed to fetch workflows');
      const parsedResponse = await response.json();
      setWorkflows(prev => ({ // Use previous state to keep show=true
        ...prev,
        workflows: parsedResponse.workflows || [],
        loading: false,
        // show: true - already set
        // editingWorkflowIndex: null - already set
        // editedWorkflow: null - already set
      }));
    } catch (error) {
        console.error("Error loading workflows:", error);
        setWorkflows(prev => ({ ...prev, workflows: [], loading: false })); // Keep show=true on error
    }
  };

  const toggleWorkflowList = () => {
    if (!workflows.show) {
      setWindowMode({
        mode: "initial", // Keep mode as initial when showing workflows
        width: INITIAL_WINDOW_WIDTH, // Use initial width
        height: MAX_WINDOW_HEIGHT,  // Use max height
      });
      reloadWorkflows(); // Reload when opening
    } else {
      setWorkflows(prev => ({
        ...prev,
        show: false,
        editingWorkflowIndex: null, // Reset editing state when closing
        editedWorkflow: null,
      }));
      // Return to previous initial state dimensions
      setWindowMode({
        mode: "initial",
        width: INITIAL_WINDOW_WIDTH,
        height: INITIAL_WINDOW_HEIGHT, // Or potentially restore dynamic height? Start simple.
      });
    }
  };

  const attachWorkflow = (index: number) => {
    const workflow = workflows.workflows[index];
    if (workflow) {
      setAttachedWorkflow(workflow); // Set the attached workflow state
      setChatInput(""); // Clear any existing chat input
      toggleWorkflowList(); // Close the workflow list
      // Focus the input after a short delay to allow UI updates
      setTimeout(() => chatInputRef.current?.focus(), 50);
    }
  };

  // Function to start editing a workflow
  const startEditingWorkflow = (index: number) => {
     setWorkflows(prev => ({
       ...prev,
       editingWorkflowIndex: index,
       // Deep copy the workflow to avoid modifying the original state directly
       editedWorkflow: JSON.parse(JSON.stringify(prev.workflows[index])),
     }));
  };

  // Function to cancel editing
  const cancelEditWorkflow = () => {
      setWorkflows(prev => ({
        ...prev,
        editingWorkflowIndex: null,
        editedWorkflow: null,
      }));
  };

  // Function to handle changes in the edited workflow (title and steps)
  const handleEditChange = (field: 'Title' | 'Step', value: string, stepIndex?: number) => {
    setWorkflows(prev => {
      if (!prev.editedWorkflow) return prev; // Should not happen

      const updatedWorkflow = { ...prev.editedWorkflow };

      if (field === 'Title') {
        updatedWorkflow.Title = value;
      } else if (field === 'Step' && stepIndex !== undefined) {
        // Ensure Steps array exists (it should, but good practice)
        updatedWorkflow.Steps = updatedWorkflow.Steps || [];
        updatedWorkflow.Steps[stepIndex] = value;
      }

      return { ...prev, editedWorkflow: updatedWorkflow };
    });
  };

  // Function to handle changes in the important input fields
  const handleImportantFieldChange = (index: number, key: 'Field' | 'Value', value: string) => {
    setWorkflows(prev => {
      if (!prev.editedWorkflow) return prev;

      // Clone the existing fields or start with an empty array
      const updatedFields: ImportantField[] = [...(prev.editedWorkflow["Important Input Text Fields"] || [])];

      if (index >= 0 && index < updatedFields.length) {
          // Clone the specific field object before modifying
          updatedFields[index] = { ...updatedFields[index], [key]: value };
      }

      return {
        ...prev,
        editedWorkflow: {
          ...prev.editedWorkflow,
          "Important Input Text Fields": updatedFields,
        },
      };
    });
  };

  // Function to add a new step during editing
  const addStepToWorkflow = () => {
    setWorkflows(prev => {
      if (!prev.editedWorkflow) return prev;
      const updatedWorkflow = {
        ...prev.editedWorkflow,
        // Ensure Steps array exists before adding
        Steps: [...(prev.editedWorkflow.Steps || []), ""] // Add empty step
      };
      return { ...prev, editedWorkflow: updatedWorkflow };
    });
  };

  // Function to remove a step during editing
  const removeStepFromWorkflow = (stepIndex: number) => {
    setWorkflows(prev => {
      if (!prev.editedWorkflow || !prev.editedWorkflow.Steps) return prev;
      const updatedWorkflow = {
        ...prev.editedWorkflow,
        Steps: prev.editedWorkflow.Steps.filter((_, index) => index !== stepIndex)
      };
      return { ...prev, editedWorkflow: updatedWorkflow };
    });
  };

  // Function to add a new important input field
  const addImportantField = () => {
    setWorkflows(prev => {
      if (!prev.editedWorkflow) return prev;
      // Ensure the array exists and clone it, then push the new object
      const updatedFields: ImportantField[] = [
        ...(prev.editedWorkflow["Important Input Text Fields"] || []),
        { Field: "", Value: "" } // Add new field object
      ];

      return {
        ...prev,
        editedWorkflow: {
          ...prev.editedWorkflow,
          "Important Input Text Fields": updatedFields,
        },
      };
    });
  };

  // Function to remove an important input field
  const removeImportantField = (indexToRemove: number) => {
      setWorkflows(prev => {
          // Use the correct property name with quotes
          if (!prev.editedWorkflow || !prev.editedWorkflow["Important Input Text Fields"]) return prev;

          // Use the correct property name with quotes
          const updatedFields = prev.editedWorkflow["Important Input Text Fields"].filter((_, index) => index !== indexToRemove);

          return {
              ...prev,
              editedWorkflow: {
                  ...prev.editedWorkflow,
                   // Use the correct property name with quotes
                  "Important Input Text Fields": updatedFields,
              },
          };
      });
  };

  // Function to save the edited workflow (client-side only for now)
  const saveEditedWorkflow = () => {
    setWorkflows(prev => {
      if (prev.editingWorkflowIndex === null || !prev.editedWorkflow) return prev; // Should not happen

      const updatedWorkflows = [...prev.workflows];
      updatedWorkflows[prev.editingWorkflowIndex] = prev.editedWorkflow;

      // TODO: Add backend API call here later

      console.log("Saving workflow (client-side):", prev.editedWorkflow); // For debugging

      return {
        ...prev,
        workflows: updatedWorkflows,
        editingWorkflowIndex: null, // Exit edit mode
        editedWorkflow: null,
      };
    });
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

  // Helper function to format workflow Steps and Fields into a single string
  const formatWorkflowForQuery = (workflow: Workflow): string => {
    // Start with Steps header
    let output = "Steps:\n" + workflow.Steps.join("\n");

    // Add separator after steps
    output += "\n----";

    if (workflow["Important Input Text Fields"] && workflow["Important Input Text Fields"].length > 0) {
      // Add Fields header
      output += "\nImportant text field inputs:\n";
      workflow["Important Input Text Fields"].forEach(field => {
        if (field.Field || field.Value) {
            output += `- ${field.Field || '[No Field Name]'}: ${field.Value || '[No Value]'}\n`;
        }
      });
      // Add separator after fields
      output += "----";
    }
    // No trim needed here as separators handle spacing
    return output;
  };

  // Detach workflow function
  const detachWorkflow = () => {
    setAttachedWorkflow(null);
    // Optionally clear chat input or keep it?
    // setChatInput("");
    setTimeout(() => chatInputRef.current?.focus(), 0); // Keep focus on input
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

        <div ref={commandBarRef} className="command-bar non-draggable" >
             {/* Workflow Attachment Indicator */}
             {attachedWorkflow && (
                <div className="workflow-attachment-indicator non-draggable"> 
                    {/* Icon Removed */}
                    <span className="indicator-title" title={attachedWorkflow.Title}> 
                         / {attachedWorkflow.Title} 
                    </span>
                    {/* Restore Remove Button */}
                    <button
                        className="indicator-remove" 
                        onClick={detachWorkflow}
                        title="Detach Workflow"
                    >
                        <X size={12} />
                    </button>
                </div>
             )}

             {/* Command Bar Content (Buttons + Input) */}
             <div className="command-bar-content">
                 <div className="action-buttons">
                   <button className="action-button record" onClick={startRecording} title="Record Actions">
                     <ScreenShare size={18} />
                   </button>
                   <button className="action-button replay" onClick={toggleWorkflowList} title="Replay Workflow">
                     <MousePointerClick size={18} />
                   </button>
                 </div>
                 <div className="input-container">
                   <textarea
                     ref={chatInputRef}
                     value={chatInput}
                     onChange={(e) => setChatInput(e.target.value)}
                     onKeyDown={handleKeyDown}
                     placeholder={attachedWorkflow ? "Add instructions for attached workflow..." : "Command your computer..."} // Dynamic placeholder
                     className="command-input"
                     rows={1}
                     autoFocus
                   />
                   <button
                     className="send-button"
                     onClick={handleSendMessage}
                     disabled={!attachedWorkflow && !chatInput.trim()} // Disabled only if no workflow AND no text
                     title={attachedWorkflow ? "Send Workflow + Instructions" : "Send command (Enter) | New line (Cmd/Ctrl+Enter)"} // Dynamic title
                   >
                     <ArrowUp size={16} />
                   </button>
               </div>
             </div>

             {/* Execution Context Bar (VM/Model) */}
             <div className="execution-context-bar non-draggable">
                 {/* VM Dropdown */} 
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="vm-selector-button"> {/* Use button for better accessibility */} 
                            <Computer size={14} className="vm-icon" /> 
                            <span className="vm-text">{selectedVm}</span>
                            <ChevronDown size={14} className="dropdown-chevron"/>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="bottom">
                        {availableVms.map((vm) => (
                            <DropdownMenuItem key={vm} onSelect={() => setSelectedVm(vm)}>
                                {vm}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                 </DropdownMenu>

                 {/* Model Dropdown */} 
                 <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                        <button className="model-indicator-button"> {/* Use button */} 
                            <span className="model-text">{selectedModel}</span>
                             <ChevronDown size={14} className="dropdown-chevron"/>
                        </button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end" side="bottom">
                        {availableModels.map((model) => (
                            <DropdownMenuItem key={model} onSelect={() => setSelectedModel(model)}>
                                {model}
                            </DropdownMenuItem>
                        ))}
                     </DropdownMenuContent>
                 </DropdownMenu>
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
        >
          {/* Centered Stop Button */} 
          <button
            onClick={stopRecording}
            className="stop-recording-button-centered"
            title="Stop Recording"
          >
            <ScreenShareOff size={18} className="mr-1.5"/> 
            Stop Recording
          </button>
        </div>
      </div>
    );
  }

  // Conditional rendering for workflows mode 
  if (workflows.show) {
     return (
         <div className="workflows-container non-draggable" style={{ height: `${windowMode.height}px` }}>
           <div className="workflows-header draggable">
             <button className="back-button non-draggable" onClick={toggleWorkflowList}>
               ← Back
             </button>
             <div className="workflows-title">
                {workflows.editingWorkflowIndex !== null ? 'Edit Workflow' : 'Saved Workflows'}
             </div>
             {/* Optional: Add a Save/Cancel button here if editing */}
             {workflows.editingWorkflowIndex !== null && workflows.editedWorkflow && (
                <div className="workflow-edit-header-actions non-draggable">
                    <button
                        className="workflow-action-button save"
                        onClick={saveEditedWorkflow}
                        title="Save Changes"
                    >
                        <Save size={16} />
                    </button>
                    <button
                        className="workflow-action-button cancel"
                        onClick={cancelEditWorkflow}
                        title="Cancel Edit"
                    >
                        <X size={16} />
                    </button>
                </div>
             )}
           </div>

           {workflows.loading ? (
             <div className="workflows-loading">
               <Loader2 className="animate-spin" size={16} />
             </div>
           ) : workflows.editingWorkflowIndex !== null && workflows.editedWorkflow ? (
              // *** EDIT WORKFLOW VIEW ***
              <ScrollArea className="workflow-edit-view-scroll-area">
                <div className="workflow-edit-view">
                  {/* Title Section */}
                  <div className="workflow-edit-form-group">
                      <label htmlFor="workflow-title">Title</label>
                      <input
                          type="text"
                          id="workflow-title"
                          value={workflows.editedWorkflow.Title}
                          onChange={(e) => handleEditChange('Title', e.target.value)}
                          className="workflow-edit-input"
                          placeholder="Workflow Title"
                      />
                  </div>

                  {/* Steps Section */}
                  <div className="workflow-edit-form-group">
                      <label>Steps</label>
                      {/* <ScrollArea className="workflow-steps-edit-area"> */} {/* Removed inner ScrollArea */}
                          {(workflows.editedWorkflow.Steps || []).map((step, stepIdx) => (
                              <div key={stepIdx} className="workflow-edit-step">
                                  <textarea
                                      value={step}
                                      onChange={(e) => handleEditChange('Step', e.target.value, stepIdx)}
                                      className="workflow-edit-textarea"
                                      placeholder={`Step ${stepIdx + 1}`}
                                      rows={2} // Start with 2 rows, could auto-resize later
                                  />
                                  <button
                                      className="workflow-step-delete-button"
                                      onClick={() => removeStepFromWorkflow(stepIdx)}
                                      title="Remove Step"
                                  >
                                      <Trash2 size={14} />
                                  </button>
                              </div>
                          ))}
                      {/* </ScrollArea> */}
                      <button
                          className="workflow-step-add-button"
                          onClick={addStepToWorkflow}
                          title="Add Step"
                      >
                          <PlusCircle size={16} className="mr-1"/> Add Step
                      </button>
                  </div>

                  {/* Important Fields Section */}
                  <div className="workflow-edit-form-group">
                      <label>Important Input Fields</label>
                      <div className="workflow-important-fields-area">
                          {/* Map over the correctly typed array */}
                          {(workflows.editedWorkflow["Important Input Text Fields"] || []).map((field, fieldIdx) => (
                              <div key={fieldIdx} className="workflow-edit-important-field">
                                  <input
                                      type="text"
                                      value={field.Field}
                                      onChange={(e) => handleImportantFieldChange(fieldIdx, 'Field', e.target.value)}
                                      className="workflow-edit-input field-key"
                                      placeholder="Field Name (e.g., Search Term)"
                                  />
                                  <input
                                      type="text"
                                      value={field.Value}
                                      onChange={(e) => handleImportantFieldChange(fieldIdx, 'Value', e.target.value)}
                                      className="workflow-edit-input field-value"
                                      placeholder="Value (e.g., [item name])"
                                  />
                                  <button
                                      className="workflow-important-field-delete-button"
                                      onClick={() => removeImportantField(fieldIdx)}
                                      title="Remove Field"
                                  >
                                      <Trash2 size={14} />
                                  </button>
                              </div>
                          ))}
                      </div>
                      <button
                          className="workflow-step-add-button" /* Reusing add button style */
                          onClick={addImportantField}
                          title="Add Important Field"
                      >
                          <PlusCircle size={16} className="mr-1"/> Add Field
                      </button>
                  </div>
                </div>
              </ScrollArea>
           ) : workflows.workflows.length > 0 ? (
             // *** WORKFLOW LIST VIEW ***
             <ScrollArea className="workflows-list">
               {workflows.workflows.map((workflow, idx) => (
                 <div key={idx} className="workflow-item">
                   <span className="workflow-item-title">{workflow.Title}</span>
                   <div className="workflow-item-actions">
                     <button
                       className="workflow-action-button edit"
                       onClick={() => startEditingWorkflow(idx)}
                       title="Edit Workflow"
                     >
                       <Edit size={16} />
                     </button>
                     <button
                       className="workflow-action-button attach"
                       onClick={() => attachWorkflow(idx)} // Use attachWorkflow
                       title="Attach Workflow to Command Bar"
                     >
                       <Paperclip size={16} />
                     </button>
                     <button
                       className="workflow-action-button run"
                       onClick={() => attachWorkflow(idx)} // Use attachWorkflow
                       title="Attach Workflow to Command Bar"
                     >
                       <Play size={16} />
                     </button>
                   </div>
                 </div>
               ))}
             </ScrollArea>
           ) : (
              // Empty state remains the same
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
