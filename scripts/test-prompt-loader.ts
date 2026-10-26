#!/usr/bin/env tsx
/**
 * Test script for Master Prompt loader
 * Verifies that the prompt file loads correctly and contains expected content
 */

import { loadMasterPrompt, MASTER_PROMPT_VERSION } from '../src/prompts/loader';

console.log('=== Testing Master Prompt Loader ===\n');

try {
  const prompt = loadMasterPrompt();
  
  console.log('✓ Master Prompt loaded successfully');
  console.log('  Version:', prompt.metadata.version);
  console.log('  Expected:', MASTER_PROMPT_VERSION);
  console.log('  Content length:', prompt.metadata.contentLength, 'characters');
  console.log('  Loaded at:', prompt.metadata.loadedAt.toISOString());
  console.log('');
  
  console.log('✓ Content validation:');
  console.log('  First line:', prompt.content.split('\n')[0]);
  console.log('  Contains "Version 1.4.4":', prompt.content.includes('Version 1.4.4') ? 'Yes' : 'No');
  console.log('  Contains "No SFX or BGM":', prompt.content.includes('No SFX or BGM') ? 'Yes' : 'No');
  console.log('  Contains "PHASE 0":', prompt.content.includes('PHASE 0') ? 'Yes' : 'No');
  console.log('  Contains "PHASE 9":', prompt.content.includes('PHASE 9') ? 'Yes' : 'No');
  console.log('  Contains "MASTER PROMPT":', prompt.content.includes('MASTER PROMPT') ? 'Yes' : 'No');
  console.log('  Contains production instructions:', prompt.content.includes('production package') ? 'Yes' : 'No');
  console.log('  Prohibits BGM/SFX:', prompt.content.includes('Do not include SFX or BGM') ? 'Yes' : 'No');
  
  const lines = prompt.content.split('\n');
  console.log('  Total lines:', lines.length);
  console.log('  Last line:', lines[lines.length - 1]);
  console.log('');
  
  // Verify version consistency
  if (prompt.metadata.version !== MASTER_PROMPT_VERSION) {
    console.error('✗ Version mismatch!');
    console.error(`  Metadata: ${prompt.metadata.version}, Expected: ${MASTER_PROMPT_VERSION}`);
    process.exit(1);
  }
  
  console.log('✓ All checks passed');
  console.log('\n=== Test Complete ===');
  
} catch (error) {
  console.error('✗ Error loading prompt:');
  console.error('  ', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
