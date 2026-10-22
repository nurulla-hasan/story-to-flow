import { z } from "zod";
import { getRepo, DEFAULT_PROJECT_ID } from "@/lib/db";
import { errorResponse, parseBody } from "@/lib/http";
import {
  languageSchema,
  newId,
  slugify,
  type CharacterRecord,
} from "@/lib/types";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  visual_lock: z.string().trim().min(20).max(1200),
  voice_lock: z.string().trim().min(10).max(600),
  language: languageSchema.default("bn"),
  outfit_changes: z.boolean().default(false),
});

export async function GET() {
  try {
    return Response.json({
      characters: getRepo().getCharacters(DEFAULT_PROJECT_ID),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request, createSchema);
    const repo = getRepo();
    const existing = repo.getCharacters(DEFAULT_PROJECT_ID);
    let id = slugify(body.name) || "character-" + newId().slice(0, 5);
    while (existing.some((character) => character.id === id)) {
      id = `${id}-${existing.length + 1}`;
    }
    const character: CharacterRecord = {
      id,
      name: body.name,
      visual_lock: body.visual_lock,
      voice_lock: body.voice_lock,
      language: body.language,
      outfit_changes: body.outfit_changes,
      refImage: null,
    };
    repo.addCharacter(DEFAULT_PROJECT_ID, character);
    return Response.json({ character, data: repo.getProjectData(DEFAULT_PROJECT_ID) });
  } catch (error) {
    return errorResponse(error);
  }
}
