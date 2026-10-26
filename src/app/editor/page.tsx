"use client"

import * as React from "react"
import { Play, Pause, SkipBack, SkipForward, Volume2 } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { StudioClip } from "@/components/studio/types"

// Placeholder clip data (replace with real project data later)
const PLACEHOLDER_CLIP: StudioClip = {
  id: "clip-1",
  index: 1,
  duration: 8,
  imageUrl: null,
  mediaUrl: null,
  videoUrl: null,
  imagePrompt: "A wise old clockmaker winding a mechanical spider in his workshop",
  narration: "",
  motion: "static",
  sfx: "none",
  sfxConfig: { type: "none", offset: 0, volume: 1, speed: 1 },
}

export default function StudioEditorPage() {
  const [isPlaying, setIsPlaying] = React.useState(false)

  return (
    <div className="flex h-screen bg-background">
      {/* Left: Editor preview */}
      <section className="flex flex-1 flex-col">
        {/* Top: Stage */}
        <div className="flex-1 flex items-center justify-center bg-editor-stage p-8 overflow-hidden">
          <div className="relative w-96 h-160 bg-editor-screen rounded-2xl overflow-hidden shadow-2xl stage-grid">
            {/* Placeholder video preview */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-editor-on-dark-muted text-center">
                Video preview placeholder
              </span>
            </div>
            {/* Overlay play button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity"
            >
              {isPlaying ? (
                <Pause className="w-16 h-16 text-white" />
              ) : (
                <Play className="w-16 h-16 text-white" />
              )}
            </button>
          </div>
        </div>

        {/* Bottom: Timeline */}
        <div className="h-48 border-t border-border bg-editor-chrome p-4">
          <div className="flex items-center gap-2 mb-4">
            <Button size="icon" variant="ghost">
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost">
              <SkipForward className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="default" onClick={() => setIsPlaying(!isPlaying)}>
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Volume2 className="w-4 h-4 text-muted-foreground ml-2" />
          </div>
          <div className="space-y-2">
            <div className="h-12 bg-editor-line rounded-lg relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1/3 bg-primary/80 rounded-lg" />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>0:00</span>
              <span className="flex-1" />
              <span>0:08</span>
            </div>
          </div>
        </div>
      </section>

      {/* Right: Studio panel */}
      <aside className="w-96 border-l border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Studio</h2>
          <p className="text-sm text-muted-foreground">Clip details</p>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {/* Clip prompt */}
            <div>
              <Label htmlFor="prompt" className="mb-2 block">Image prompt</Label>
              <Input
                id="prompt"
                placeholder="Describe the scene..."
                value={PLACEHOLDER_CLIP.imagePrompt}
              />
            </div>

            {/* Motion presets */}
            <div>
              <Label className="mb-2 block">Motion preset</Label>
              <div className="grid grid-cols-2 gap-2">
                {["static", "zoom-in", "pan-left", "pan-right"].map((motion) => (
                  <button
                    key={motion}
                    className={cn(
                      "px-3 py-2 text-sm border rounded-lg text-left capitalize",
                      PLACEHOLDER_CLIP.motion === motion
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    {motion.replace("-", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* SFX */}
            <div>
              <Label className="mb-2 block">Sound effect</Label>
              <select className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm">
                <option value="none">None</option>
                <option value="whoosh">Whoosh / Fly</option>
                <option value="cartoon-pop">Cartoon Pop</option>
                <option value="heavy-thud">Heavy Thud</option>
                <option value="magic-chime">Magic Chime</option>
              </select>
            </div>

            {/* Volume */}
            <div>
              <Label htmlFor="volume" className="mb-2 block">Volume: 1.0</Label>
              <input
                id="volume"
                type="range"
                min="0"
                max="2"
                step="0.1"
                defaultValue="1"
                className="w-full accent-primary"
              />
            </div>
          </div>
        </ScrollArea>
      </aside>
    </div>
  )
}
