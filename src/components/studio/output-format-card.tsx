import { Card, CardContent } from "@/components/ui/card"
import { Info } from "lucide-react"

export function OutputFormatCard() {
  return (
    <Card className="rounded-2xl border border-border shadow-xs bg-card overflow-hidden">
      <CardContent>
        <div className="flex items-start gap-3.5">
          {/* Solid Blue Circle with Info Icon */}
          <div className="size-8 rounded-full bg-info text-info-foreground flex items-center justify-center shrink-0 shadow-xs">
            <Info className="size-4.5" />
          </div>

          {/* Text Content */}
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground leading-tight">
              Output format
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You&apos;ll get a complete raw Markdown text with scene breakdowns, voiceover, and image prompts. Just copy and use it directly.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
