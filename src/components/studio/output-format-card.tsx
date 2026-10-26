import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Info } from "lucide-react"

export function OutputFormatCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3.5">
          {/* Solid Blue Circle with Info Icon */}
          <div className="size-8 rounded-full bg-info text-info-foreground flex items-center justify-center shrink-0 shadow-xs">
            <Info className="size-4.5" />
          </div>

          {/* Text Content */}
          <div className="space-y-1">
            <CardTitle>Output format</CardTitle>
            <CardDescription className="leading-relaxed">
              You&apos;ll get a complete raw Markdown text with scene breakdowns, voiceover, and image prompts. Just copy and use it directly.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}
