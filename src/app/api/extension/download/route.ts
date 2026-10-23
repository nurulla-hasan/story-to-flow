import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { errorResponse } from "@/lib/http";

export async function GET() {
  try {
    const extensionDir = path.join(process.cwd(), "extension");
    if (!fs.existsSync(extensionDir)) {
      return Response.json({ error: "Extension files not found" }, { status: 404 });
    }

    const zip = new JSZip();

    function addDirToZip(currentDir: string, zipFolder: JSZip) {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          const subFolder = zipFolder.folder(entry.name);
          if (subFolder) addDirToZip(fullPath, subFolder);
        } else if (entry.isFile()) {
          const content = fs.readFileSync(fullPath);
          zipFolder.file(entry.name, content);
        }
      }
    }

    addDirToZip(extensionDir, zip);

    const buffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 9 },
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="story-to-flow-extension.zip"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
