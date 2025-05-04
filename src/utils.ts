import { Workflow } from './types'; // Import Workflow type

export const cleanToolAction = (action: string | undefined): string | undefined => {
  if (!action) return undefined;
  return action
    .replace(/_/g, " ") // Replace underscores globally
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

// Helper function to format workflow Steps and Fields into a single string
export const formatWorkflowForQuery = (workflow: Workflow): string => {
  // Start with Steps header
  let output = "Steps:\n" + workflow.Steps.join("\n");

  // Add separator after steps
  output += "\n----";

  // Use the correct property name with quotes and check if it exists
  const importantFields = workflow["Important Input Text Fields"];
  if (importantFields && importantFields.length > 0) {
    // Add Fields header
    output += "\nImportant text field inputs:\n";
    importantFields.forEach(field => {
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