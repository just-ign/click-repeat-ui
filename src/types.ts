// Define structure for Important Input Text Fields
export interface ImportantField {
    Field: string;
    Value: string;
}

// Define Workflow type
export interface Workflow {
    Title: string;
    Steps: string[];
    "Important Input Text Fields"?: ImportantField[]; // Use correct name and type
}

// Define AgentMessage type
// TODO: Define this based on actual structure from electronAPI
export interface AgentMessage {
    type: 'user-input' | 'action-progress' | 'action-error' | 'request-complete' | 'assistant-progress';
    content: string;
    actionDetails?: { // Optional action details
        action?: string;
        tool_input?: { action?: string }; // Nested optional structure
        // Add other potential fields if needed
    };
    // Add other potential fields from the message structure
} 