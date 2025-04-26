import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { PlayCircle, Mic, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getWorkflows } from "./api";

const INITIAL_WINDOW_HEIGHT = 40;
const INITIAL_WINDOW_WIDTH = 200;
const MINIMIZED_WINDOW_WIDTH = 250;
const MINIMIZED_WINDOW_HEIGHT = 32;
const RECORDING_WINDOW_WIDTH = 100;
const RECORDING_WINDOW_HEIGHT = 30;
const PLAY_WINDOW_WIDTH = 300;
const PLAY_WINDOW_HEIGHT = 300;

function App() {
  const removeListenerRef = useRef<(() => void) | null>(null);
  const minimisedDivRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
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

    // Store the removal function
    removeListenerRef.current = removeListener;

    return () => {
      // Remove the event listener
      if (removeListenerRef.current) {
        removeListenerRef.current();
      }
    };
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
      setWindowMode({
        mode: "initial",
        height: INITIAL_WINDOW_HEIGHT,
        width: INITIAL_WINDOW_WIDTH,
      });
    } else if (latestMessage) {
      setWindowMode({
        mode: "minimized",
        height: Math.max(
          minimisedDivRef.current?.clientHeight || 0,
          MINIMIZED_WINDOW_HEIGHT
        ),
        width: MINIMIZED_WINDOW_WIDTH,
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
      ...windowMode,
      mode: "initial",
      height: INITIAL_WINDOW_HEIGHT,
      width: INITIAL_WINDOW_WIDTH,
    });
    window.electronAPI.stopRecording();
  };

  const reloadWorkflows = async () => {
    setWorkflows({
      ...workflows,
      loading: true,
      show: true
    });
    const response = await getWorkflows();
    const parsedResponse = await response.json();
    setWorkflows({
      ...workflows,
      workflows: parsedResponse.workflows,
      loading: false,
      show: true
    });
  };

  const toggleWorkflowList = () => {
    if (!workflows.show) {
      setWindowMode({
        ...windowMode,
        mode: "initial",
        width: PLAY_WINDOW_WIDTH,
        height: PLAY_WINDOW_HEIGHT,
      });
      reloadWorkflows();
    } else {
      setWorkflows({
        ...workflows,
        show: false,
      });
      setWindowMode({
        ...windowMode,
        mode: "initial",
        width: INITIAL_WINDOW_WIDTH,
        height: INITIAL_WINDOW_HEIGHT,
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
    setWindowMode({
      ...windowMode,
      mode: "minimized",
      width: MINIMIZED_WINDOW_WIDTH,
      height: MINIMIZED_WINDOW_HEIGHT,
    });
  };

  if (isRecording) {
    return (
      <div className="h-[100vh] flex items-center justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={stopRecording}
          className="h-8 font-medium text-white hover:bg-white/10 hover:text-white"
        >
          <div className="mr-2 h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          Stop
        </Button>
      </div>
    );
  }

  if (workflows.show) {
    return (
      <div className="p-2">
        <Button variant="ghost" size="sm" onClick={toggleWorkflowList}>
          Back
        </Button>
        {workflows.loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="animate-spin" size={16} />
          </div>
        ) : (
          <ScrollArea className="pt-2">
            {workflows.workflows.map((workflow, idx) => (
              <div
                key={idx}
                className="px-2 py-1 text-sm text-white hover:bg-white/10 cursor-pointer rounded"
                onClick={() => selectWorkflow(idx)}
              >
                {workflow.Title}
              </div>
            ))}
          </ScrollArea>
        )}
      </div>
    );
  }

  if (windowMode.mode === "minimized" && latestMessage) {
    return (
      <div
        ref={minimisedDivRef}
        className="w-full mx-auto shadow-lg flex px-2 py-1"
      >
        <div
          className={`flex-1 min-w-0 text-xs text-muted-foreground flex ${
            isToolAction ? "items-center" : ""
          }`}
        >
          {cleanToolAction(isToolAction) || latestMessage.content}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100vh] flex items-center justify-center">
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={startRecording}
          className="h-8 font-medium text-white hover:bg-white/10 hover:text-white"
        >
          <Mic className="mr-1.5" size={16} />
          Record
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleWorkflowList}
          className="h-8 font-medium text-white hover:bg-white/10 hover:text-white"
        >
          <PlayCircle className="mr-1.5" size={16} />
          Play
        </Button>
      </div>
    </div>
  );
}

export default App;
