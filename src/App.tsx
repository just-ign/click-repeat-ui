import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar } from "@/components/ui/avatar";
import { useEffect, useState, useRef } from "react";
import { X, Search, GithubIcon, MousePointer, Keyboard } from "lucide-react";

// Maximum height we'll allow the window to expand to
const MAX_WINDOW_HEIGHT = 600;

// Scale factor to make window a bit smaller than the full width
const WIDTH_SCALE_FACTOR = 0.8;

// Icons for different message types
const MessageIcon = ({
  type,
  actionType,
}: {
  type: string;
  actionType?: string;
}) => {
  if (type === "user-input") {
    return <Search className="h-5 w-5 text-primary" />;
  }

  // For action progress messages
  switch (actionType) {
    case "mouse_move":
    case "mouse_click":
    case "mouse_drag":
      return <MousePointer className="h-5 w-5 text-blue-400" />;
    case "keyboard_type":
    case "keyboard_press":
      return <Keyboard className="h-5 w-5 text-green-400" />;
    default:
      return <GithubIcon className="h-5 w-5 text-gray-400" />;
  }
};

function App() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ProgressMessage[]>([]);
  const windowWidth = useRef<number>(700); // Default window width
  const messageRef = useRef<HTMLDivElement>(null);
  const removeListenerRef = useRef<(() => void) | null>(null);

  // Effect to set up IPC listener when the component mounts
  useEffect(() => {
    // Add listener for progress updates and store the cleanup function
    const removeListener = window.electronAPI.onAgentProgress(
      (message: ProgressMessage) => {
        console.log("Received message:", message);
        setMessages((prevMessages) => [message, ...prevMessages]); // Add new messages to top
      }
    );

    // Store the removal function
    removeListenerRef.current = removeListener;

    // Get current window width
    const updateWindowWidth = () => {
      windowWidth.current = window.innerWidth;
    };

    // Set initial width
    updateWindowWidth();

    // Listen for window resize events to update the stored width
    window.addEventListener("resize", updateWindowWidth);

    // Clean up the listener when the component unmounts
    return () => {
      window.removeEventListener("resize", updateWindowWidth);
      // Remove the event listener
      if (removeListenerRef.current) {
        removeListenerRef.current();
      }
    };
  }, []);

  // Effect to handle window sizing based on messages array state
  useEffect(() => {
    const handleWindowResize = async () => {
      if (messages.length === 0) {
        // If messages are empty, use the small window size (60px height)
        await window.electronAPI.resizeWindow({
          height: 60,
          animated: true,
        });
      } else {
        // If messages exist, make it a square, but cap at MAX_WINDOW_HEIGHT and scale down a bit
        const targetHeight = Math.min(
          windowWidth.current * WIDTH_SCALE_FACTOR,
          MAX_WINDOW_HEIGHT
        );
        await window.electronAPI.resizeWindow({
          height: targetHeight,
          animated: true,
        });
      }
    };

    // Call the resize function when messages change
    handleWindowResize();
  }, [messages.length]); // Only re-run when the number of messages changes

  const handleSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      window.electronAPI
        .handleQuery(inputValue)
        .then((result) => {
          console.log("Query result:", result);
        })
        .catch((err) => {
          console.error("Error in handleQuery:", err);
        });

      setInputValue("");
    }
  };

  // Function to clear all messages
  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <div
      className="flex flex-col w-screen shadow-lg h-full"
      style={{
        height: messages.length > 0 ? "100%" : "60px",
        transition: "height 0.3s ease-in-out",
        borderRadius: "8px",
        backgroundColor: "var(--background)",
        color: "var(--foreground)"
      }}
    >
      {/* Input area with clear button */}
      <div className="w-full flex items-center px-3 h-[60px] draggable rounded-t-lg bg-background">
        <Search className="h-5 w-5 text-muted-foreground mr-2" />
        <Input
          placeholder="Gen Agent"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleSubmit}
          className="flex-1 h-10 border-none text-base bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0"
          style={{
            color: "var(--foreground)",
            boxShadow: "none",
            outline: "none"
          }}
        />
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearMessages}
            className="ml-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Only show divider and messages if we have messages */}
      {messages.length > 0 && (
        <>
          <Separator className="w-full opacity-30" />

          {/* Messages container */}
          <div
            ref={messageRef}
            className="w-full overflow-auto"
            style={{
              maxHeight: `calc(100% - 60px)`,
              transition: "max-height 0.3s ease-in-out",
            }}
          >
            {messages.map((msg, index) => (
              <div
                key={index}
                className="flex items-start px-4 py-3 hover:bg-secondary/40 transition-colors"
              >
                <Avatar className="h-8 w-8 mr-3 bg-background border flex items-center justify-center">
                  <MessageIcon
                    type={msg.type}
                    actionType={msg.actionDetails?.type}
                  />
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{msg.content}</div>
                  <div className="text-xs text-muted-foreground truncate mt-1">
                    {msg.type === "user-input"
                      ? "User query"
                      : msg.actionDetails?.type || "Action"}{" "}
                    — {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
