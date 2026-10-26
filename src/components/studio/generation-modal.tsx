"use client"

import { useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader2 } from "lucide-react"

interface GenerationModalProps {
  story: string
  visualStyle: string
  aspectRatio: string
  duration: string | number
  staticFramePacing: string | number
  onConfirm: () => void
  disabled?: boolean
}

export function GenerationModal({
  story,
  visualStyle,
  aspectRatio,
  duration,
  staticFramePacing,
  onConfirm,
  disabled = false,
}: GenerationModalProps) {
  const [open, setOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleConfirm = async () => {
    setIsGenerating(true)
    try {
      await onConfirm()
    } finally {
      setIsGenerating(false)
    }
    setOpen(false)
  }

  return (
    <>
      <Button
        size="lg"
        className="w-full"
        onClick={() => setOpen(true)}
        disabled={disabled || !story.trim()}
      >
        <Sparkles />
        Generate Production Package
      </Button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Confirm Generation"
        description="Review your settings before generating the production package."
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/50">
            <h4 className="mb-2 text-sm font-semibold">Story Preview</h4>
            <p className="line-clamp-4 text-sm text-muted-foreground">
              {story.length > 200 ? `${story.substring(0, 200)}...` : story}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {story.length.toLocaleString()} characters
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border">
              <span className="text-sm text-muted-foreground">Visual Style</span>
              <span className="text-sm font-medium">{visualStyle}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border">
              <span className="text-sm text-muted-foreground">Aspect Ratio</span>
              <span className="text-sm font-medium">{aspectRatio}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border">
              <span className="text-sm text-muted-foreground">Duration</span>
              <span className="text-sm font-medium">
                {duration === "Auto" ? "Auto" : `${duration} seconds`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Frame Pacing
              </span>
              <span className="text-sm font-medium">
                {staticFramePacing === "Auto"
                  ? "Auto"
                  : `${staticFramePacing}s per image`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Generating...
              </>
            ) : (
              "Generate Now"
            )}
          </Button>
        </div>
      </Modal>
    </>
  )
}