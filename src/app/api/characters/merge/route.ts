import { z } from "zod";
import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse, parseBody } from "@/lib/http";
import { reassembleAll } from "@/lib/pipeline";
import { syncStudioProjectPrompts } from "@/lib/studio-sync";

const mergeSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, mergeSchema);
    if (body.sourceId === body.targetId) {
      return Response.json({ error: "Pick two different characters." }, { status: 400 });
    }
    const repo = getRepo();
    const characters = repo.getCharacters(DEFAULT_PROJECT_ID);
    const source = characters.find((item) => item.id === body.sourceId);
    const target = characters.find((item) => item.id === body.targetId);
    if (!source || !target) {
      return Response.json({ error: "Character not found" }, { status: 404 });
    }
    const maxPeople = repo.getProject(DEFAULT_PROJECT_ID).settings.maxPeople;
    for (const scene of repo.getScenes(DEFAULT_PROJECT_ID)) {
      if (!scene.characters.includes(source.id) && !scene.characters.includes(target.id)) {
        continue;
      }
      const merged = [
        ...new Set(
          scene.characters.map((id) => (id === source.id ? target.id : id)),
        ),
      ].slice(0, maxPeople);
      repo.updateScene(DEFAULT_PROJECT_ID, scene.n, { characters: merged });
      if (scene.dialogue?.speaker === source.id) {
        repo.updateScene(DEFAULT_PROJECT_ID, scene.n, {
          dialogue: { ...scene.dialogue, speaker: target.id },
        });
      }
    }
    if (!target.refImage && source.refImage) {
      repo.updateCharacter(DEFAULT_PROJECT_ID, target.id, {
        refImage: source.refImage,
      });
    }
    repo.deleteCharacter(DEFAULT_PROJECT_ID, source.id);
    const changedPrompts = reassembleAll(DEFAULT_PROJECT_ID);
    const studioPrompts = syncStudioProjectPrompts({
      characterIdMap: { [source.id]: target.id },
    });
    return Response.json({
      ok: true,
      changedPrompts,
      studioPrompts,
      data: repo.getProjectData(DEFAULT_PROJECT_ID),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
