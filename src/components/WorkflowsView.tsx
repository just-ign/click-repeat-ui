import React from 'react';
import { Loader2, Save, X, Trash2, PlusCircle, Edit, Paperclip, Play } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Workflow, ImportantField } from '../types'; // Relative path

interface WorkflowsViewState {
    show: boolean;
    workflows: Workflow[];
    loading: boolean;
    editingWorkflowIndex: number | null;
    editedWorkflow: Workflow | null;
}

interface WorkflowsViewProps {
    workflowsState: WorkflowsViewState;
    windowHeight: number;
    toggleWorkflowList: () => void;
    saveEditedWorkflow: () => void;
    cancelEditWorkflow: () => void;
    handleEditChange: (field: 'Title' | 'Step', value: string, stepIndex?: number) => void;
    removeStepFromWorkflow: (stepIndex: number) => void;
    addStepToWorkflow: () => void;
    handleImportantFieldChange: (index: number, key: 'Field' | 'Value', value: string) => void;
    removeImportantField: (indexToRemove: number) => void;
    addImportantField: () => void;
    startEditingWorkflow: (index: number) => void;
    attachWorkflow: (index: number) => void;
}

const WorkflowsView: React.FC<WorkflowsViewProps> = ({
    workflowsState,
    windowHeight,
    toggleWorkflowList,
    saveEditedWorkflow,
    cancelEditWorkflow,
    handleEditChange,
    removeStepFromWorkflow,
    addStepToWorkflow,
    handleImportantFieldChange,
    removeImportantField,
    addImportantField,
    startEditingWorkflow,
    attachWorkflow
}) => {

    const { 
        workflows, 
        loading, 
        editingWorkflowIndex, 
        editedWorkflow 
    } = workflowsState;

    return (
        <div className="workflows-container non-draggable" style={{ height: `${windowHeight}px` }}>
            <div className="workflows-header draggable">
                <button className="back-button non-draggable" onClick={toggleWorkflowList}>
                    ← Back
                </button>
                <div className="workflows-title">
                    {editingWorkflowIndex !== null ? 'Edit Workflow' : 'Saved Workflows'}
                </div>
                {editingWorkflowIndex !== null && editedWorkflow && (
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

            {loading ? (
                <div className="workflows-loading">
                    <Loader2 className="animate-spin" size={16} />
                </div>
            ) : editingWorkflowIndex !== null && editedWorkflow ? (
                // *** EDIT WORKFLOW VIEW ***
                <ScrollArea className="workflow-edit-view-scroll-area">
                    <div className="workflow-edit-view">
                        {/* Title Section */}
                        <div className="workflow-edit-form-group">
                            <label htmlFor="workflow-title">Title</label>
                            <input
                                type="text"
                                id="workflow-title"
                                value={editedWorkflow.Title}
                                onChange={(e) => handleEditChange('Title', e.target.value)}
                                className="workflow-edit-input"
                                placeholder="Workflow Title"
                            />
                        </div>

                        {/* Steps Section */}
                        <div className="workflow-edit-form-group">
                            <label>Steps</label>
                            {(editedWorkflow.Steps || []).map((step, stepIdx) => (
                                <div key={stepIdx} className="workflow-edit-step">
                                    <textarea
                                        value={step}
                                        onChange={(e) => handleEditChange('Step', e.target.value, stepIdx)}
                                        className="workflow-edit-textarea"
                                        placeholder={`Step ${stepIdx + 1}`}
                                        rows={2}
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
                            <button
                                className="workflow-step-add-button"
                                onClick={addStepToWorkflow}
                                title="Add Step"
                            >
                                <PlusCircle size={16} className="mr-1" /> Add Step
                            </button>
                        </div>

                        {/* Important Fields Section */}
                        <div className="workflow-edit-form-group">
                            <label>Important Input Fields</label>
                            <div className="workflow-important-fields-area">
                                {(editedWorkflow["Important Input Text Fields"] || []).map((field, fieldIdx) => (
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
                                <PlusCircle size={16} className="mr-1" /> Add Field
                            </button>
                        </div>
                    </div>
                </ScrollArea>
            ) : workflows.length > 0 ? (
                // *** WORKFLOW LIST VIEW ***
                <ScrollArea className="workflows-list">
                    {workflows.map((workflow, idx) => (
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
};

export default WorkflowsView; 