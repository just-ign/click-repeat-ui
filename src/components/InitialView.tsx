import React from 'react';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import ReactMarkdown from 'react-markdown';
import { User, Wrench, X, ScreenShare, MousePointerClick, ArrowUp, Computer, ChevronDown, Workflow as WorkflowIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AgentMessage, Workflow } from '../types';

interface InitialViewProps {
    messages: AgentMessage[];
    historyScrollAreaRef: React.RefObject<HTMLDivElement>;
    commandBarRef: React.RefObject<HTMLDivElement>;
    attachedWorkflow: Workflow | null;
    detachWorkflow: () => void;
    startRecording: () => void;
    toggleWorkflowList: () => void;
    chatInputRef: React.RefObject<HTMLTextAreaElement>;
    chatInput: string;
    setChatInput: (value: string) => void;
    handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    handleSendMessage: () => void;
    selectedVm: string;
    availableVms: string[];
    setSelectedVm: (vm: string) => void;
    selectedModel: string;
    availableModels: string[];
    setSelectedModel: (model: string) => void;
}

const InitialView: React.FC<InitialViewProps> = ({
    messages,
    historyScrollAreaRef,
    commandBarRef,
    attachedWorkflow,
    detachWorkflow,
    startRecording,
    toggleWorkflowList,
    chatInputRef,
    chatInput,
    setChatInput,
    handleKeyDown,
    handleSendMessage,
    selectedVm,
    availableVms,
    setSelectedVm,
    selectedModel,
    availableModels,
    setSelectedModel
}) => {
    return (
        <div className="app-container-initial draggable">
            {messages.length > 0 && (
                <ScrollArea ref={historyScrollAreaRef} className="history-area non-draggable">
                    <div className="history-content">
                        {messages.map((message, idx) => {
                            let typeClass = 'agent';
                            let IconComponent = null;

                            if (message.type === 'user-input') {
                                typeClass = 'user';
                                IconComponent = User;
                            } else if (message.type === 'action-progress') {
                                typeClass = 'tool';
                                IconComponent = Wrench;
                            } else if (message.type === 'action-error') {
                                typeClass = 'error';
                            }

                            if (message.type === 'request-complete') return null;

                            return (
                                <div key={idx} className={`history-message ${typeClass}`}>
                                    {IconComponent && (
                                        <div className="history-icon-container">
                                            <IconComponent size={14} />
                                        </div>
                                    )}
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
                {attachedWorkflow && (
                    <div className="workflow-attachment-indicator non-draggable">
                        <span className="indicator-title" title={attachedWorkflow.Title}>
                            / {attachedWorkflow.Title}
                        </span>
                        <button
                            className="indicator-remove"
                            onClick={detachWorkflow}
                            title="Detach Workflow"
                        >
                            <X size={12} />
                        </button>
                    </div>
                )}

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
                            placeholder={attachedWorkflow ? "Add instructions for attached workflow..." : "Command your computer..."}
                            className="command-input"
                            rows={1}
                            autoFocus
                        />
                        <button
                            className="send-button"
                            onClick={handleSendMessage}
                            disabled={!attachedWorkflow && !chatInput.trim()}
                            title={attachedWorkflow ? "Send Workflow + Instructions" : "Send command (Enter) | New line (Cmd/Ctrl+Enter)"}
                        >
                            <ArrowUp size={16} />
                        </button>
                    </div>
                </div>

                <div className="execution-context-bar non-draggable">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="vm-selector-button">
                                <Computer size={14} className="vm-icon" />
                                <span className="vm-text">{selectedVm}</span>
                                <ChevronDown size={14} className="dropdown-chevron" />
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

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="model-indicator-button">
                                <span className="model-text">{selectedModel}</span>
                                <ChevronDown size={14} className="dropdown-chevron" />
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
};

export default InitialView; 