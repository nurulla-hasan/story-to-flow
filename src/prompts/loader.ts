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
export const MASTER_PROMPT_VERSION = "v1.6.1";

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
 * Load a Master Prompt from the file system.
 * Defaults to the active MASTER_PROMPT_VERSION (e.g. src/prompts/master-prompt-v1.5.9.txt),
 * while supporting explicit historical version loading (e.g. "v1.5.8").
 * 
 * This function is server-side only and will fail if called in client code.
 * 
 * @param version - Optional version string (defaults to MASTER_PROMPT_VERSION)
 * @throws {Error} If the prompt file is missing, empty, or unreadable
 * @returns {MasterPrompt} The loaded prompt with metadata
 */
export function loadMasterPrompt(version: string = MASTER_PROMPT_VERSION): MasterPrompt {
  const promptPath = path.join(
    process.cwd(),
    `src/prompts/master-prompt-${version}.txt`
  );

  // Check if file exists
  if (!fs.existsSync(promptPath)) {
    throw new Error(
      `Master Prompt ${version} not found at ${promptPath}. ` +
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
      `Failed to read Master Prompt ${version} from ${promptPath}: ${errorMessage}`
    );
  }

  // Validate content is non-empty
  const trimmedContent = content.trim();
  if (trimmedContent.length === 0) {
    throw new Error(
      `Master Prompt ${version} at ${promptPath} is empty. ` +
      "The prompt file must contain the complete prompt text."
    );
  }

  // A prompt file that contains only a title/version marker is not a valid historical prompt.
  // Reject truncated version stubs instead of silently treating them as production instructions.
  if (trimmedContent.length < 1000) {
    throw new Error(
      `Master Prompt ${version} appears incomplete (${trimmedContent.length} characters). ` +
      "Restore the complete prompt text before loading this version."
    );
  }

  // Return prompt with metadata
  return {
    content: trimmedContent,
    metadata: {
      version,
      loadedAt: new Date(),
      contentLength: trimmedContent.length,
    },
  };
}
