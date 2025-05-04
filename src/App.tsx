import { useEffect, useRef, useState } from "react";
import { PlayCircle, Mic, Loader2, ArrowUp, Square, User, Wrench, Radio, Repeat, CircleDot, ScreenShare, ScreenShareOff, MousePointerClick, Play, Edit, Paperclip, PlusCircle, Trash2, Save, X, Workflow as WorkflowIcon, Computer, ChevronDown } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import ReactMarkdown from 'react-markdown';
import { getWorkflows } from "./api";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
    INITIAL_WINDOW_HEIGHT,
    MAX_WINDOW_HEIGHT,
    INITIAL_WINDOW_WIDTH,
    MINIMIZED_DEFAULT_WIDTH,
    MINIMIZED_WINDOW_HEIGHT,
    RECORDING_WINDOW_WIDTH,
    RECORDING_WINDOW_HEIGHT,
    VMS,
    MODELS
} from './constants';
import { Workflow, ImportantField, AgentMessage } from './types';
import { cleanToolAction, formatWorkflowForQuery } from './utils';
import RecordingView from './components/RecordingView';
import MinimizedView from './components/MinimizedView';
import WorkflowsView from './components/WorkflowsView';
import InitialView from './components/InitialView';

const PLAY_WINDOW_WIDTH = 300;
const PLAY_WINDOW_HEIGHT = 300;

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
  const [availableVms, setAvailableVms] = useState<string[]>(VMS);
  const [selectedVm, setSelectedVm] = useState<string>(VMS[0]);
  const [availableModels, setAvailableModels] = useState<string[]>(MODELS);
  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0]);
  const historyScrollAreaRef = useRef<HTMLDivElement>(null);
  const commandBarRef = useRef<HTMLDivElement>(null);

  const isRecording = windowMode.mode === "recording";

  const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;

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

  useEffect(() => {
    if (messages.length > 0 && latestMessage && windowMode.mode !== 'minimized') {
      const targetWidth = MINIMIZED_DEFAULT_WIDTH;
      setWindowMode({
        mode: "minimized",
        height: MINIMIZED_WINDOW_HEIGHT + 16,
        width: targetWidth,
      });
    } else if (messages.length === 0 && windowMode.mode !== 'initial') {
      setWindowMode({
        mode: "initial",
        height: INITIAL_WINDOW_HEIGHT,
        width: INITIAL_WINDOW_WIDTH,
      });
    }
  }, [messages, latestMessage]); 

  useEffect(() => {
    window.electronAPI.toggleWindowMode({
      mode: windowMode.mode,
      height: windowMode.height,
      width: windowMode.width,
    });
  }, [windowMode]);

  useEffect(() => {
    if (chatInputRef.current && windowMode.mode === 'initial') {
      chatInputRef.current.style.height = 'auto';
      const scrollHeight = chatInputRef.current.scrollHeight;
      const maxTextareaHeight = Math.max(26, MAX_WINDOW_HEIGHT * 0.4); 
      const newTextareaHeight = Math.min(scrollHeight, maxTextareaHeight);
      chatInputRef.current.style.height = `${newTextareaHeight}px`;
    }
  }, [chatInput, windowMode.mode]); 

  useEffect(() => {
    if (windowMode.mode === 'initial' && !workflows.show && workflows.editingWorkflowIndex === null) {
      const historyHeight = historyScrollAreaRef.current?.scrollHeight || 0;
      const commandBarHeight = commandBarRef.current?.offsetHeight || 50;
      
      const requiredHeight = Math.min(MAX_WINDOW_HEIGHT, historyHeight + commandBarHeight);
      
      if (requiredHeight > 0 && requiredHeight !== windowMode.height) {
          console.log(`Initial mode resize: history=${historyHeight}, commandBar=${commandBarHeight}, required=${requiredHeight}`);
          setWindowMode(prev => ({ ...prev, height: requiredHeight }));
      }
    }
  }, [messages, chatInput, windowMode.mode, workflows.show, attachedWorkflow, workflows.editingWorkflowIndex]);

  useEffect(() => {
    if (windowMode.mode === 'minimized' && minimisedDivRef.current) {
      const timer = setTimeout(() => {
        if (minimisedDivRef.current) {
          const requiredHeight = Math.min(MAX_WINDOW_HEIGHT, minimisedDivRef.current.scrollHeight);
          
          setWindowMode(prev => {
            if (prev.mode === 'minimized' && requiredHeight !== prev.height) {
               return { ...prev, height: requiredHeight };
            }
            return prev;
          });
        }
      }, 50);

      return () => clearTimeout(timer);
    }
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

        if (userInstructions) {
          if (!combinedQuery.endsWith("----")) {
             combinedQuery += "\n----";
          }
          combinedQuery += `\n${userInstructions}`;
        }

        console.log("Sending combined query:", combinedQuery);
        window.electronAPI.handleQuery(combinedQuery);

        setAttachedWorkflow(null);
        setChatInput("");

    } else if (userInstructions) {
        const queryToSend = `${userInstructions}`;
        console.log("Sending standard query:", queryToSend);
        window.electronAPI.handleQuery(queryToSend);
        setChatInput("");
    }
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
      editingWorkflowIndex: null,
      editedWorkflow: null,
    });
    try {
      const response = await getWorkflows();
      if (!response.ok) throw new Error('Failed to fetch workflows');
      const parsedResponse = await response.json();
      setWorkflows(prev => ({
        ...prev,
        workflows: parsedResponse.workflows || [],
        loading: false,
      }));
    } catch (error) {
        console.error("Error loading workflows:", error);
        setWorkflows(prev => ({ ...prev, workflows: [], loading: false }));
    }
  };

  const toggleWorkflowList = () => {
    if (!workflows.show) {
      setWindowMode({
        mode: "initial",
        width: INITIAL_WINDOW_WIDTH,
        height: MAX_WINDOW_HEIGHT,
      });
      reloadWorkflows();
    } else {
      setWorkflows(prev => ({
        ...prev,
        show: false,
        editingWorkflowIndex: null,
        editedWorkflow: null,
      }));
      setWindowMode({
        mode: "initial",
        width: INITIAL_WINDOW_WIDTH,
        height: INITIAL_WINDOW_HEIGHT,
      });
    }
  };

  const attachWorkflow = (index: number) => {
    const workflow = workflows.workflows[index];
    if (workflow) {
      setAttachedWorkflow(workflow);
      setChatInput("");
      toggleWorkflowList();
      setTimeout(() => chatInputRef.current?.focus(), 50);
    }
  };

  const startEditingWorkflow = (index: number) => {
     setWorkflows(prev => ({
       ...prev,
       editingWorkflowIndex: index,
       editedWorkflow: JSON.parse(JSON.stringify(prev.workflows[index])),
     }));
  };

  const cancelEditWorkflow = () => {
      setWorkflows(prev => ({
        ...prev,
        editingWorkflowIndex: null,
        editedWorkflow: null,
      }));
  };

  const handleEditChange = (field: 'Title' | 'Step', value: string, stepIndex?: number) => {
    setWorkflows(prev => {
      if (!prev.editedWorkflow) return prev;

      const updatedWorkflow = { ...prev.editedWorkflow };

      if (field === 'Title') {
        updatedWorkflow.Title = value;
      } else if (field === 'Step' && stepIndex !== undefined) {
        updatedWorkflow.Steps = updatedWorkflow.Steps || [];
        updatedWorkflow.Steps[stepIndex] = value;
      }

      return { ...prev, editedWorkflow: updatedWorkflow };
    });
  };

  const handleImportantFieldChange = (index: number, key: 'Field' | 'Value', value: string) => {
    setWorkflows(prev => {
      if (!prev.editedWorkflow) return prev;

      const updatedFields: ImportantField[] = [...(prev.editedWorkflow["Important Input Text Fields"] || [])];

      if (index >= 0 && index < updatedFields.length) {
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

  const addStepToWorkflow = () => {
    setWorkflows(prev => {
      if (!prev.editedWorkflow) return prev;
      const updatedWorkflow = {
        ...prev.editedWorkflow,
        Steps: [...(prev.editedWorkflow.Steps || []), ""],
      };
      return { ...prev, editedWorkflow: updatedWorkflow };
    });
  };

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

  const addImportantField = () => {
    setWorkflows(prev => {
      if (!prev.editedWorkflow) return prev;
      const updatedFields: ImportantField[] = [
        ...(prev.editedWorkflow["Important Input Text Fields"] || []),
        { Field: "", Value: "" },
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

  const removeImportantField = (indexToRemove: number) => {
      setWorkflows(prev => {
          if (!prev.editedWorkflow || !prev.editedWorkflow["Important Input Text Fields"]) return prev;

          const updatedFields = prev.editedWorkflow["Important Input Text Fields"].filter((_, index) => index !== indexToRemove);

          return {
              ...prev,
              editedWorkflow: {
                  ...prev.editedWorkflow,
                  "Important Input Text Fields": updatedFields,
              },
          };
      });
  };

  const saveEditedWorkflow = () => {
    setWorkflows(prev => {
      if (prev.editingWorkflowIndex === null || !prev.editedWorkflow) return prev;

      const updatedWorkflows = [...prev.workflows];
      updatedWorkflows[prev.editingWorkflowIndex] = prev.editedWorkflow;

      console.log("Saving workflow (client-side):", prev.editedWorkflow);

      return {
        ...prev,
        workflows: updatedWorkflows,
        editingWorkflowIndex: null,
        editedWorkflow: null,
      };
    });
  };

  const goBackToInitial = () => {
    console.log("Stop requested, resetting UI to initial state.");
    setChatInput(""); 
    setWindowMode(prev => ({
      ...prev,
      mode: "initial",
      height: INITIAL_WINDOW_HEIGHT,
      width: INITIAL_WINDOW_WIDTH,
    }));
  };

  const detachWorkflow = () => {
    setAttachedWorkflow(null);
    setTimeout(() => chatInputRef.current?.focus(), 0);
  };

  if (isRecording) {
    return <RecordingView stopRecording={stopRecording} />;
  }

  if (workflows.show) {
    return (
      <WorkflowsView 
        workflowsState={workflows} 
        windowHeight={windowMode.height}
        toggleWorkflowList={toggleWorkflowList}
        saveEditedWorkflow={saveEditedWorkflow}
        cancelEditWorkflow={cancelEditWorkflow}
        handleEditChange={handleEditChange}
        removeStepFromWorkflow={removeStepFromWorkflow}
        addStepToWorkflow={addStepToWorkflow}
        handleImportantFieldChange={handleImportantFieldChange}
        removeImportantField={removeImportantField}
        addImportantField={addImportantField}
        startEditingWorkflow={startEditingWorkflow}
        attachWorkflow={attachWorkflow}
      />
    );
  }
  
  if (windowMode.mode === 'minimized' && latestMessage) {
    return (
      <MinimizedView 
        ref={minimisedDivRef}
        latestMessage={latestMessage} 
        goBackToInitial={goBackToInitial} 
      />
    );
  }

  if (windowMode.mode === 'initial' && !workflows.show) {
    return (
        <InitialView
            messages={messages}
            historyScrollAreaRef={historyScrollAreaRef}
            commandBarRef={commandBarRef}
            attachedWorkflow={attachedWorkflow}
            detachWorkflow={detachWorkflow}
            startRecording={startRecording}
            toggleWorkflowList={toggleWorkflowList}
            chatInputRef={chatInputRef}
            chatInput={chatInput}
            setChatInput={setChatInput}
            handleKeyDown={handleKeyDown}
            handleSendMessage={handleSendMessage}
            selectedVm={selectedVm}
            availableVms={availableVms}
            setSelectedVm={setSelectedVm}
            selectedModel={selectedModel}
            availableModels={availableModels}
            setSelectedModel={setSelectedModel}
        />
    );
  }

  return null; 

}

export default App;
