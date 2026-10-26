import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
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
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-warning-subtle flex items-center justify-center shrink-0 border border-warning/20">
            <Lightbulb className="size-5 text-warning" />
          </div>
          <div>
            <CardTitle>How it works</CardTitle>
            <CardDescription>Four simple steps to full video production</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
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
      </CardContent>
    </Card>
  )
}
