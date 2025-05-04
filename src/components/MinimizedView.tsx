import React, { useRef, useEffect, forwardRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Square } from 'lucide-react';
import { AgentMessage } from '../types'; // Correct relative path
import { cleanToolAction } from '../utils'; // Correct relative path

interface MinimizedViewProps {
  latestMessage: AgentMessage | null;
  goBackToInitial: () => void;
  // We might need to pass windowMode state for dynamic height adjustment
  // Or handle the ref/height logic inside App.tsx based on mode
}

// Use forwardRef to accept the ref from the parent
const MinimizedView = forwardRef<HTMLDivElement, MinimizedViewProps>((
  { latestMessage, goBackToInitial }, 
  ref // Receive the ref here
) => {
  // const minimisedDivRef = useRef<HTMLDivElement>(null); // Remove internal ref

  // If no latest message, don't render (shouldn't happen in minimized mode normally)
  if (!latestMessage) return null;

  // Determine content to display
  const isToolAction =
    latestMessage?.actionDetails?.tool_input?.action ||
    latestMessage?.actionDetails?.action;
  const contentToRender = cleanToolAction(isToolAction) || latestMessage.content;

  // Note: The height adjustment logic based on minimisedDivRef.current.scrollHeight
  // might need to remain in App.tsx as it modifies App's windowMode state.
  // Alternatively, pass a setHeight function prop, but let's keep it simple first.

  return (
    <div
      ref={ref} // Use the forwarded ref
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
});

export default MinimizedView;
