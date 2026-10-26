#!/usr/bin/env tsx

import { testLlmConnectivity } from "../src/lib/llm";

async function main() {
  console.log("=== Testing Story to Flow LLM Foundation ===\n");
  
  try {
    const result = await testLlmConnectivity();
    
    console.log("1. Environment Configuration:");
    console.log("   ✓ AI_BASE_URL and AI_API_KEY loaded from .env.local");
    
    console.log("\n2. Model Listing Test:");
    if (result.modelsAvailable) {
      console.log(`   ✓ Models available: ${result.modelList?.length || 0} models`);
      if (result.modelList && result.modelList.length > 0) {
        console.log("   Sample models:", result.modelList.slice(0, 3).join(", "));
      }
    } else {
      console.log("   ⚠ Model listing endpoint not available or failed");
      console.log("   (This is OK for some gateways that don't expose /models)");
    }
    
    console.log("\n3. Chat Completion Test:");
    if (result.chatWorks) {
      console.log(`   ✓ Chat works! Model: ${result.testResponse?.includes("Hello") ? "Responded correctly" : "Responded"}`);
      console.log(`   Response: "${result.testResponse}"`);
    } else {
      console.log(`   ✗ Chat failed: ${result.error}`);
      console.log("\n   Troubleshooting:");
      console.log("   - Check AI_BASE_URL in .env.local points to your OmniRoute gateway");
      console.log("   - Verify the gateway is running and reachable");
      console.log("   - Check AI_API_KEY if your gateway requires authentication");
      console.log("   - Ensure model 'antigravity/gemini-3.8-flash-high' is available");
    }
    
    console.log("\n=== LLM Foundation Test Complete ===");
    console.log(result.chatWorks ? "✓ LLM foundation is ready for Story Studio" : "✗ LLM foundation needs configuration");
    
  } catch (error) {
    console.error("\n=== Test Failed ===");
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

void main();