"use client";

import Link from "next/link";
import {
  Sparkles,
  Settings,
  ArrowRight,
  BookOpen,
  Mic,
  Film,
  Clock,
  Palette,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function DocsPage() {
  return (
    <>
      {/* Content Container */}
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Help &amp; Documentation
              </h1>
              <Badge variant="outline">Master Prompt v1.5.7</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Complete workflow guides, Cartesia voiceover tips, and Google Flow
              prompt best practices.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/settings">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Settings className="size-3.5" />
                <span>Configure Models</span>
              </Button>
            </Link>

            <Link href="/studio">
              <Button size="sm" className="gap-1.5">
                <Sparkles className="size-3.5" />
                <span>Go to Studio</span>
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* 12-Column Responsive Docs Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Main Column (8 cols on lg screens) */}
          <div className="lg:col-span-8 space-y-6">
            {/* 1. Production Workflow Guide */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                    <BookOpen className="size-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>End-to-End Production Workflow</CardTitle>
                    <CardDescription>
                      How StoryForge converts raw stories into ready-to-render
                      multimedia assets
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Step 1 */}
                  <div className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-4 shadow-xs">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0 mt-0.5">
                      1
                    </span>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-foreground">
                        Write or Paste Your Story
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Enter your story in either Bengali or English.
                        StoryForge preserves your core events, causality, and
                        emotional twist without inventing false facts or ruining
                        story continuity.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-4 shadow-xs">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0 mt-0.5">
                      2
                    </span>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-foreground">
                        AI Narrative Planning &amp; Direction
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Click &ldquo;Generate Production Package&rdquo;. The AI
                        acts as your Bengali storyteller, storyboard director,
                        and visual supervisor—generating a separate, continuous
                        voiceover track and detailed chronological scene
                        prompts.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-4 shadow-xs">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0 mt-0.5">
                      3
                    </span>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-foreground">
                        Generate Voiceover with Cartesia TTS
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Click &ldquo;Copy Voiceover&rdquo; from the dedicated
                        Voiceover Card. Paste it directly into Cartesia to
                        synthesize natural, expressive Bangladeshi Bengali
                        narration.
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-4 shadow-xs">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs shrink-0 mt-0.5">
                      4
                    </span>
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-foreground">
                        Generate Visuals in Google Flow
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Use the &ldquo;Scene &amp; Image Prompts&rdquo; card to
                        copy prompts scene by scene. Static scenes are rendered
                        in Image mode; hero scenes are rendered in Video mode
                        (4.0s).
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Visual Style Guide */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                    <Palette className="size-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Visual Style Directory</CardTitle>
                    <CardDescription>
                      Supported visual aesthetics optimized for AI image and
                      video generation models
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-border p-3.5 bg-card space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground text-sm">
                        Auto (Recommended)
                      </span>
                      <Badge variant="secondary">Default</Badge>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      The AI dynamically evaluates story tone, genre, and
                      characters to select the best visual direction.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border p-3.5 bg-card space-y-1">
                    <span className="font-semibold text-foreground text-sm">
                      3D Animated Cartoon
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      Stylized 3D character animation with warm cinematic
                      lighting, expressive eyes, and vibrant colors.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border p-3.5 bg-card space-y-1">
                    <span className="font-semibold text-foreground text-sm">
                      Cinematic Realism
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      Grounded photorealistic lighting, natural skin textures,
                      dynamic camera lenses, and authentic depth.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border p-3.5 bg-card space-y-1">
                    <span className="font-semibold text-foreground text-sm">
                      Warm Rural Drama
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      Atmospheric rural Bangladeshi realism with rich clay road
                      textures, lush vegetation, and warm earth tones.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border p-3.5 bg-card space-y-1">
                    <span className="font-semibold text-foreground text-sm">
                      Painterly Storybook
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      Textured digital brushstrokes, soft edges, fairy-tale
                      lighting, and rich artistic color palettes.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border p-3.5 bg-card space-y-1">
                    <span className="font-semibold text-foreground text-sm">
                      Anime &amp; Manga Style
                    </span>
                    <p className="text-muted-foreground leading-relaxed">
                      Clean cel-shaded linework, expressive character designs,
                      dynamic lighting, and Japanese animation aesthetics.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Audio & Scene Timing Calibration */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                    <Clock className="size-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Scene Timing &amp; Audio Calibration</CardTitle>
                    <CardDescription>
                      Understanding provisional timecodes and 4.0-second hero
                      video coverage
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3.5 text-xs text-muted-foreground leading-relaxed">
                  <p>
                    Master Prompt v1.5.7 uses an empirical calibration rate of{" "}
                    <strong className="text-foreground">
                      ~2.4 spoken Bengali words per second
                    </strong>{" "}
                    (approximately 140–145 words per minute) to generate
                    continuous, non-overlapping scene timecodes starting at
                    0:00.
                  </p>

                  <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
                    <h4 className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-success" />
                      <span>The 4.0-Second Hero Video Rule:</span>
                    </h4>
                    <p className="text-2xs leading-relaxed">
                      All generated hero videos from Google Flow are strictly
                      4.0 seconds long. If the assigned voiceover for that scene
                      takes longer (e.g. 6.0s or 7.5s), the prompt includes an
                      edit instruction to hold the final video frame (freeze
                      frame) or extend with a complementary still image. The
                      voiceover is never cut or rushed to force a 4-second clip.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar Column (4 cols on lg screens) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Quick Reference Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Specs</CardTitle>
                <CardDescription>
                  System specifications at a glance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">
                      Voiceover Language
                    </span>
                    <span className="font-medium text-foreground">
                      Bangladeshi Bengali
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">
                      Visual Prompts
                    </span>
                    <span className="font-medium text-foreground">
                      English (Google Flow)
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">
                      Active Master Prompt
                    </span>
                    <Badge variant="secondary">v1.5.7</Badge>
                  </div>

                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-muted-foreground">Default Model</span>
                    <span className="font-mono text-2xs text-foreground truncate max-w-28">
                      gemini-3.8-flash
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">BGM / SFX</span>
                    <span className="text-muted-foreground">
                      Excluded by design
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cartesia Tips */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mic className="size-4 text-primary" />
                  <CardTitle>Cartesia TTS Tips</CardTitle>
                </div>
                <CardDescription>
                  Best practices for Bengali speech synthesis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed list-disc list-inside">
                  <li>
                    Copy only from the &ldquo;Full Voiceover&rdquo; card for
                    clean text.
                  </li>
                  <li>
                    Paragraph breaks provide natural pauses for the voice model
                    to breathe.
                  </li>
                  <li>
                    Ensure proper Bengali punctuation (দাঁড়ি “।” and কমা “,”).
                  </li>
                  <li>Avoid adding artificial SSML or pause tags.</li>
                </ul>
              </CardContent>
            </Card>

            {/* Google Flow Tips */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Film className="size-4 text-primary" />
                  <CardTitle>Google Flow Tips</CardTitle>
                </div>
                <CardDescription>
                  Creating static images and hero video clips
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed list-disc list-inside">
                  <li>Static scenes: paste into Image Generation mode.</li>
                  <li>
                    Hero scenes: select Video/Animate mode and set duration to
                    4.0s.
                  </li>
                  <li>
                    Keep prompt locks intact to maintain character consistency.
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Auto-Save & Reset Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Lightbulb className="size-4 text-warning" />
                  <CardTitle>Workspace Persistence</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                  <p>
                    Your story draft and generated packages are automatically
                    auto-saved in your browser. Reloading or navigating away
                    will not lose your work.
                  </p>
                  <p>
                    To start completely fresh, click &ldquo;Reset Studio&rdquo;
                    in the Studio settings bar.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
