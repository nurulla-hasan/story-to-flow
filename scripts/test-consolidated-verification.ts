import { GET as getModels } from "../src/app/api/models/route";
import { POST as processStory } from "../src/app/api/story/process/route";
import { NextRequest } from "next/server";
import { DEFAULT_MODEL } from "../src/lib/constants";

async function runConsolidatedVerification() {
  console.log("==================================================");
  console.log("CONSOLIDATED VERIFICATION — TASK 8");
  console.log("==================================================\n");

  // 1. Verify GET /api/models
  console.log("1. Testing GET /api/models (Server-side discovery):");
  try {
    const modelsResponse = await getModels();
    const modelsData = await modelsResponse.json();

    console.log(`   ✓ Status: ${modelsResponse.status}`);
    console.log(`   ✓ Source: ${modelsData.source}`);
    console.log(`   ✓ Total models discovered: ${modelsData.count}`);
    console.log(`   ✓ Default model: ${modelsData.defaultModel}`);

    // Verify secrets are NOT exposed
    const stringified = JSON.stringify(modelsData);
    const hasSecretKey = stringified.includes("sk-") || stringified.includes("AI_API_KEY");
    if (!hasSecretKey) {
      console.log("   ✓ Security check passed: No API keys or credentials exposed");
    } else {
      console.error("   ✗ SECURITY ISSUE: API key found in models output!");
    }

    // Verify DEFAULT_MODEL is present
    const hasDefault = modelsData.models.some((m: { id: string }) => m.id === DEFAULT_MODEL);
    if (hasDefault) {
      console.log(`   ✓ Default model '${DEFAULT_MODEL}' is present in options`);
    } else {
      console.error(`   ✗ Default model missing from models list!`);
    }
  } catch (err) {
    console.error("   ✗ Error testing /api/models:", err);
  }

  // 2. Test Invalid Model ID rejection in POST /api/story/process
  console.log("\n2. Testing POST /api/story/process with invalid model format:");
  try {
    const invalidReq = new NextRequest("http://localhost:3000/api/story/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        story: "এক বনে এক চতুর শিয়াল থাকত।",
        settings: {
          model: "invalid model with spaces and <injection>",
        },
      }),
    });

    const invalidRes = await processStory(invalidReq);
    const invalidData = await invalidRes.json();
    if (invalidRes.status === 400 && invalidData.error?.includes("Invalid model ID")) {
      console.log(`   ✓ Safely rejected invalid model ID with HTTP 400: "${invalidData.error}"`);
    } else {
      console.log(`   ⚠ Response status: ${invalidRes.status}, data:`, invalidData);
    }
  } catch (err) {
    console.error("   ✗ Error testing invalid model:", err);
  }

  // 3. Real Bengali Story Generation (STEP 6)
  console.log("\n3. Testing Real Bengali Story Generation with OmniRoute Gateway:");
  const freshStory = `বর্ষার এক মেঘলা বিকেলে গ্রামের মেঠো পথ ধরে হেঁটে চলেছিল বৃদ্ধ রমিজ মিঞা। হাতে তার পুরোনো একটি কাঠের বাক্স, যা বহু বছর ধরে সযত্নে লুকানো ছিল। হঠাৎ পথের মোড়ে বটগাছের নিচে দাঁড়িয়ে থাকা ছোট ছেলে আবিরের সঙ্গে তার দেখা হলো। আবির রমিজের কাছে জানতে চাইল, এই বাক্সে আসলে কী আছে? রমিজ মুচকি হেসে বলল, এটা কেবল একটি বাক্স নয়, আমাদের হারানো গ্রামের বহু পুরোনো ইতিহাস।`;

  console.log("   Story Input: " + freshStory.slice(0, 70) + "...");
  console.log("   Settings: visualStyle='Auto', aspectRatio='9:16', duration='Auto', pacing='Auto'");
  console.log(`   Model: ${DEFAULT_MODEL}`);
  console.log("   Calling API (timeout: 180s)...");

  const startTime = Date.now();
  try {
    const req = new NextRequest("http://localhost:3000/api/story/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        story: freshStory,
        settings: {
          model: DEFAULT_MODEL,
          visualStyle: "Auto",
          aspectRatio: "9:16",
          duration: "Auto",
          staticFramePacing: "Auto",
        },
      }),
    });

    const res = await processStory(req);
    const data = await res.json();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (res.status === 200 && data.response) {
      console.log(`\n   ✓ SUCCESS: Story processed in ${elapsed}s (HTTP 200)`);
      console.log(`   ✓ Model used: ${data.metadata?.modelUsed}`);
      console.log(`   ✓ Prompt version: ${data.metadata?.promptVersion}`);

      const responseText: string = data.response;

      // Check Criteria 1: Prompt version metadata v1.5.5
      console.log("\n--- Output Inspection ---");
      const isVersionCorrect = data.metadata?.promptVersion === "v1.5.5";
      console.log(`   [1] Metadata prompt version v1.5.5: ${isVersionCorrect ? "✓ PASSED" : "✗ FAILED"}`);

      // Check Criteria 2: Natural Bengali opening
      const hasVoiceoverBlock = responseText.includes("```");
      const lines = responseText.split("\n");
      const firstVoiceoverLine = lines.find(l => l.includes("আজ") || l.includes("গল্প") || (l.length > 20 && !l.startsWith("```") && !l.startsWith("#")));
      console.log(`   [2] Bengali voiceover block present: ${hasVoiceoverBlock ? "✓ PASSED" : "✗ FAILED"}`);
      if (firstVoiceoverLine) {
        console.log(`       Sample opening: "${firstVoiceoverLine.slice(0, 100)}..."`);
      }

      // Check Criteria 3: No BGM or SFX
      const hasBgmOrSfx =
        /BGM|SFX|Background Music|Sound Effect|Soundtrack|সঙ্গীত/i.test(responseText) &&
        !/no sfx|no bgm|do not include sfx/i.test(responseText);
      console.log(`   [3] Prohibits BGM/SFX (no cues or fields): ${!hasBgmOrSfx ? "✓ PASSED" : "✗ FAILED (BGM/SFX found)"}`);

      // Check Criteria 4: Scene blocks with English prompts
      const sceneMatches = responseText.match(/SCENE #?\d+|Scene #?\d+/gi);
      const sceneCount = sceneMatches ? sceneMatches.length : 0;
      console.log(`   [4] Scene blocks generated: ${sceneCount > 0 ? `✓ PASSED (${sceneCount} scenes)` : "✗ FAILED"}`);

      // Check Criteria 5: Consistent visual direction
      const mentionsStyle = /Visual Style|3D|Animation|Realism|warm|cinematic/i.test(responseText);
      console.log(`   [5] Visual style direction present in scenes: ${mentionsStyle ? "✓ PASSED" : "⚠ Not explicitly tagged"}`);

      // Check Criteria 6: Raw text preserved (not truncated JSON)
      const isRawText = typeof responseText === "string" && responseText.length > 500;
      console.log(`   [6] Complete raw text preserved (${responseText.length} chars): ${isRawText ? "✓ PASSED" : "✗ FAILED"}`);

      console.log("\n--- Preview of Output (First 800 chars) ---");
      console.log(responseText.slice(0, 800) + "...\n");
    } else {
      console.error(`   ✗ Generation failed: Status ${res.status}`);
      console.error("   Error details:", data);
    }
  } catch (err) {
    console.error("   ✗ Generation threw error:", err);
  }
}

void runConsolidatedVerification();
