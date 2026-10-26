import { Card, CardContent } from "@/components/ui/card"
import { Lightbulb } from "lucide-react"

export function HowItWorksCard() {
  const steps = [
    "Write your story in Bengali or English.",
    "Adjust the production settings (or keep the defaults).",
    "Click Generate to create your production package.",
    "Copy the output and use it with Cartesia and Google Flow.",
  ]

  return (
    <Card>
      <CardContent>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-warning-subtle flex items-center justify-center shrink-0 border border-warning/20">
              <Lightbulb className="size-5 text-warning" />
            </div>
            <h2 className="text-base font-bold text-foreground leading-tight">
              How it works
            </h2>
          </div>

          {/* Numbered Steps */}
          <div className="space-y-3">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="size-5 rounded-full bg-info-badge text-info-badge-foreground text-xs font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="text-xs text-muted-foreground leading-normal">
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
