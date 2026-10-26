"use client"

import { Film, Clock, Plus, Search } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

// Placeholder clips (replace with real project data later)
const PLACEHOLDER_CLIPS = [
  { id: "1", prompt: "A wise old clockmaker winding a mechanical spider in his workshop", duration: 8, status: "ready" },
  { id: "2", prompt: "The spider comes to life and scurries across the gears", duration: 8, status: "ready" },
  { id: "3", prompt: "Shadowy figures watch from the corners of the clocktower", duration: 8, status: "pending" },
  { id: "4", prompt: "The clock tower begins to chime, shaking the ground", duration: 8, status: "pending" },
]

export default function StudioPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold">Studio</h1>
            <p className="text-sm text-muted-foreground">Your video project clips</p>
          </div>
          <Button size="lg">
            <Plus className="w-4 h-4 mr-2" />
            New Clip
          </Button>
        </div>
      </header>

      {/* Search bar */}
      <div className="px-6 py-4 border-b border-border">
        <div className="max-w-7xl mx-auto flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search clips..."
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Clips grid */}
      <main className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-lg font-semibold mb-4">Scenes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PLACEHOLDER_CLIPS.map((clip) => (
              <Card key={clip.id} className="border-border hover:bg-secondary/50 transition-colors cursor-pointer">
                <CardContent className="p-0">
                  <div className="relative aspect-video bg-editor-screen">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Film className="w-12 h-12 text-editor-on-dark-muted" />
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {clip.duration}s
                    </div>
                    <div className={cn(
                      "absolute top-2 left-2 text-xs px-2 py-1 rounded font-medium",
                      clip.status === "ready"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}>
                      {clip.status}
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-foreground">
                      {clip.prompt}
                    </p>
                    <div className="flex items-center justify-between mt-4">
                      <Button size="sm" variant="outline">
                        <a href="/studio/editor">Edit</a>
                      </Button>
                      <Button size="sm">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
