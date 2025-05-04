import React from 'react';
import { ScreenShareOff } from 'lucide-react';

interface RecordingViewProps {
  stopRecording: () => void;
}

const RecordingView: React.FC<RecordingViewProps> = ({ stopRecording }) => {
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
};

export default RecordingView; 