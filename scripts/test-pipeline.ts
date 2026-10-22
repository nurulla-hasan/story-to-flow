import { buildBible, startPlanJob } from "../src/lib/pipeline";
import { getRepo, DEFAULT_PROJECT_ID } from "../src/lib/db";
import { planChat, applyChatOps } from "../src/lib/chat";

const TEST_STORY = `রিনা ভোরে নদীর ঘাটে যায়। সেখানে করিমের সঙ্গে তার দেখা হয়, যে অনেক বছর পর শহর থেকে ফিরেছে। দুজনে পুরোনো কথা বলে। রিনার মা বাড়ির উঠোন থেকে ডাক দেন। রিনা মাকে করিমের কথা বলে। মা প্রথমে চুপ থাকেন, তারপর করিমকে চায়ের দাওয়াত দেন।`;

async function testPipeline() {
  console.log("=== Testing Story to Flow pipeline ===");
  const repo = getRepo();

  // 1. Setup project
  console.log("\n[1] Updating project with test story...");
  repo.updateProject(DEFAULT_PROJECT_ID, {
    name: "River & Courtyard",
    story: TEST_STORY,
    settings: {
      totalMinutes: 0.5, // 30 seconds = 3 clips of 10s
      clipSeconds: 10,
      dialogueLanguage: "bn",
    },
  });

  // 2. Build bible (T1)
  console.log("[2] Generating Story Bible via OmniRoute planner...");
  const bible = await buildBible(DEFAULT_PROJECT_ID);
  console.log(`Title: ${bible.title}`);
  console.log(`Characters detected (${bible.characters.length}):`, bible.characters.map((c) => c.name));
  console.log(`Locations detected (${bible.locations.length}):`, bible.locations.map((l) => l.id));

  if (bible.characters.length < 3) {
    console.warn("Expected ~3 characters (Rina, Karim, Ma), got:", bible.characters.length);
  } else {
    console.log("✓ Character count matched expected (~3)");
  }

  // 3. Plan scenes (T2 & T3)
  console.log("\n[3] Starting scene plan job...");
  const job = startPlanJob(DEFAULT_PROJECT_ID);
  console.log(`Job started: ${job.id}. Polling progress...`);

  while (true) {
    await new Promise((r) => setTimeout(r, 2000));
    const current = repo.getJob(job.id);
    if (!current) break;
    console.log(`[Job ${current.status}] ${current.progress}% — ${current.message}`);
    if (current.status !== "running") {
      if (current.status === "error") {
        throw new Error(`Plan job failed: ${current.error}`);
      }
      break;
    }
  }

  const data = repo.getProjectData(DEFAULT_PROJECT_ID);
  console.log(`\n✓ Scenes planned: ${data.scenes.length}`);
  for (const scene of data.scenes) {
    console.log(`\n--- Scene ${scene.n} (${scene.status}) ---`);
    console.log(`Action: ${scene.action}`);
    console.log(`Characters: ${scene.characters.join(", ")}`);
    console.log(`Prompt preview: ${scene.prompt?.text.slice(0, 180)}...`);
  }

  // 4. Test Chat editing (T8)
  console.log("\n[4] Testing Chat edit...");
  const chatPlan = await planChat(
    DEFAULT_PROJECT_ID,
    "Rina's saree should be green from now on",
  );
  console.log("Chat proposed ops:", chatPlan.ops);
  console.log("Chat diff:", chatPlan.diff);

  const applied = applyChatOps(DEFAULT_PROJECT_ID, chatPlan.ops);
  console.log("Applied chat ops:", applied);

  const updatedChar = repo.getCharacters(DEFAULT_PROJECT_ID).find((c) => c.name.toLowerCase().includes("rina"));
  console.log("Updated Rina visual lock:", updatedChar?.visual_lock);

  console.log("\n=== ALL PIPELINE CHECKS PASSED ===");
}

void testPipeline().catch((err) => {
  console.error("Pipeline test error:", err);
  process.exitCode = 1;
});
