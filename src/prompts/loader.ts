/**
 * Master Prompt Loader
 * 
 * Server-side only module for loading the Master Prompt.
 * This module uses Node.js fs APIs and must not be imported into client code.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Current active Master Prompt version
 */
export const MASTER_PROMPT_VERSION = "v1.5.5";

/**
 * Metadata for the loaded master prompt.
 */
export interface MasterPromptMetadata {
  version: string;
  loadedAt: Date;
  contentLength: number;
}

/**
 * Complete master prompt with metadata.
 */
export interface MasterPrompt {
  content: string;
  metadata: MasterPromptMetadata;
}

/**
 * Load the active Master Prompt from the file system.
 * 
 * This function is server-side only and will fail if called in client code.
 * The prompt file must exist at src/prompts/master-prompt-v1.4.4.txt
 * 
 * @throws {Error} If the prompt file is missing, empty, or unreadable
 * @returns {MasterPrompt} The loaded prompt with metadata
 */
export function loadMasterPrompt(): MasterPrompt {
  const promptPath = path.join(
    process.cwd(),
    `src/prompts/master-prompt-${MASTER_PROMPT_VERSION}.txt`
  );

  // Check if file exists
  if (!fs.existsSync(promptPath)) {
    throw new Error(
      `Master Prompt ${MASTER_PROMPT_VERSION} not found at ${promptPath}. ` +
      "Ensure the prompt file exists in the src/prompts directory."
    );
  }

  // Read file contents
  let content: string;
  try {
    content = fs.readFileSync(promptPath, "utf-8");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to read Master Prompt ${MASTER_PROMPT_VERSION} from ${promptPath}: ${errorMessage}`
    );
  }

  // Validate content is non-empty
  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) {
    throw new Error(
      `Master Prompt ${MASTER_PROMPT_VERSION} at ${promptPath} is empty. ` +
      "The prompt file must contain the complete prompt text."
    );
  }

  // Return prompt with metadata
  return {
    content: trimmedContent,
    metadata: {
      version: MASTER_PROMPT_VERSION,
      loadedAt: new Date(),
      contentLength: trimmedContent.length,
    },
  };
}
