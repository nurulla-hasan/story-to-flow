#!/usr/bin/env tsx
/**
 * API Test Script for Story-to-Production Endpoint
 * Tests the POST /api/story/process endpoint with various scenarios
 */

import { writeFileSync } from "node:fs";
import path from "node:path";

const API_URL = "http://localhost:3000/api/story/process";

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  response?: unknown;
}

const results: TestResult[] = [];

async function testInvalidEmptyBody() {
  console.log("\n=== TEST 1: Invalid Request (Empty Body) ===");
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const data = await response.json();
    const passed = response.status === 400 && data.error;
    
    results.push({
      name: "Invalid Empty Body",
      passed,
      details: `Status: ${response.status}, Error: ${data.error || "none"}`,
      response: data,
    });

    console.log(passed ? "✓ PASSED" : "✗ FAILED");
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, JSON.stringify(data, null, 2).slice(0, 200));
  } catch (error) {
    results.push({
      name: "Invalid Empty Body",
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
    console.log("✗ FAILED - Exception:", error);
  }
}

async function testInvalidStoryTooShort() {
  console.log("\n=== TEST 2: Invalid Request (Story Too Short) ===");
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ story: "" }),
    });

    const data = await response.json();
    const passed = response.status === 400 && data.error;
    
    results.push({
      name: "Invalid Story Too Short",
      passed,
      details: `Status: ${response.status}, Error: ${data.error || "none"}`,
    });

    console.log(passed ? "✓ PASSED" : "✗ FAILED");
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, JSON.stringify(data, null, 2).slice(0, 200));
  } catch (error) {
    results.push({
      name: "Invalid Story Too Short",
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
    console.log("✗ FAILED - Exception:", error);
  }
}

async function testInvalidModelId() {
  console.log("\n=== TEST 3: Invalid Model ID Format ===");
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        story: "A short test story.",
        settings: {
          model: "invalid-model-without-slash",
        },
      }),
    });

    const data = await response.json();
    const passed = response.status === 400 && data.error?.includes("model");
    
    results.push({
      name: "Invalid Model ID",
      passed,
      details: `Status: ${response.status}, Error: ${data.error || "none"}`,
    });

    console.log(passed ? "✓ PASSED" : "✗ FAILED");
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, JSON.stringify(data, null, 2).slice(0, 200));
  } catch (error) {
    results.push({
      name: "Invalid Model ID",
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
    console.log("✗ FAILED - Exception:", error);
  }
}

async function testValidBengaliStory() {
  console.log("\n=== TEST 4: Valid Request with Bengali Story ===");
  console.log("This test will take ~60-120 seconds...");
  
  try {
    const story = "রিনা ভোরে নদীর ঘাটে যায়। সেখানে করিমের সঙ্গে তার দেখা হয়, যে অনেক বছর পর শহর থেকে ফিরেছে। দুজনে পুরোনো কথা বলে।";
    
    const startTime = Date.now();
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        story,
        settings: {
          visualStyle: "3D Animated Cartoon",
          aspectRatio: "9:16",
          duration: 30,
        },
      }),
    });

    const actualTime = Date.now() - startTime;
    const data = await response.json();
    
    // Check if response is valid
    const hasResponse = data.response && data.response.length > 0;
    const hasMetadata = data.metadata && data.metadata.modelUsed && data.metadata.promptVersion;
    const hasBengaliVoiceover = data.response?.includes("আচ্ছা") || data.response?.includes("রিনা");
    const hasBGMCue = data.response?.includes("BGM:");
    const hasScenes = data.response?.includes("SCENE #");
    const hasPrompts = data.response?.includes("PROMPT:");
    const notSettingsMenu = !data.response?.includes("SETTINGS A") && !data.response?.includes("SETTINGS B");
    
    const passed = 
      response.status === 200 &&
      hasResponse &&
      hasMetadata &&
      hasBengaliVoiceover &&
      hasBGMCue &&
      hasScenes &&
      hasPrompts &&
      notSettingsMenu;

    results.push({
      name: "Valid Bengali Story",
      passed,
      details: [
        `Status: ${response.status}`,
        `Actual time: ${actualTime}ms`,
        `Model: ${data.metadata?.modelUsed || "unknown"}`,
        `Prompt version: ${data.metadata?.promptVersion || "unknown"}`,
        `Has voiceover: ${hasBengaliVoiceover}`,
        `Has BGM cue: ${hasBGMCue}`,
        `Has scenes: ${hasScenes}`,
        `Has prompts: ${hasPrompts}`,
        `Not settings menu: ${notSettingsMenu}`,
      ].join(", "),
      response: data,
    });

    console.log(passed ? "✓ PASSED" : "✗ FAILED");
    console.log(`  Status: ${response.status}`);
    console.log(`  Processing time: ${actualTime}ms (reported: ${data.metadata?.processingTimeMs}ms)`);
    console.log(`  Model used: ${data.metadata?.modelUsed}`);
    console.log(`  Prompt version: ${data.metadata?.promptVersion}`);
    console.log(`  Response length: ${data.response?.length || 0} characters`);
    console.log(`  Has Bengali voiceover: ${hasBengaliVoiceover}`);
    console.log(`  Has BGM cue: ${hasBGMCue}`);
    console.log(`  Has scene blocks: ${hasScenes}`);
    console.log(`  Has English prompts: ${hasPrompts}`);
    console.log(`  Not settings menu: ${notSettingsMenu}`);
    
    if (data.response) {
      console.log("\n  First 500 characters of response:");
      console.log("  " + data.response.slice(0, 500).replace(/\n/g, "\n  "));
      
      // Save full response to file
      const outputPath = path.join(process.cwd(), "test-output-sample.txt");
      writeFileSync(outputPath, data.response, "utf-8");
      console.log(`\n  Full response saved to: ${outputPath}`);
    }
  } catch (error) {
    results.push({
      name: "Valid Bengali Story",
      passed: false,
      details: `Error: ${error instanceof Error ? error.message : String(error)}`,
    });
    console.log("✗ FAILED - Exception:", error);
  }
}

async function runAllTests() {
  console.log("==============================================");
  console.log("Story-to-Production API Tests");
  console.log("==============================================");

  await testInvalidEmptyBody();
  await testInvalidStoryTooShort();
  await testInvalidModelId();
  await testValidBengaliStory();

  console.log("\n==============================================");
  console.log("TEST SUMMARY");
  console.log("==============================================");
  
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  
  results.forEach((result) => {
    const status = result.passed ? "✓ PASS" : "✗ FAIL";
    console.log(`${status} - ${result.name}`);
    if (!result.passed) {
      console.log(`       ${result.details}`);
    }
  });
  
  console.log(`\nTotal: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log("\n✓ All tests passed!");
    process.exit(0);
  } else {
    console.log(`\n✗ ${total - passed} test(s) failed`);
    process.exit(1);
  }
}

runAllTests().catch(console.error);
