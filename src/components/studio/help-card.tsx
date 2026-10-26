import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card"

interface HelpCardProps {
  visible?: boolean
}

export function HelpCard({ visible = true }: HelpCardProps) {
  if (!visible) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>How it works</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>1. Enter your story in Bengali or English</p>
          <p>2. Adjust production settings to match your vision</p>
          <p>3. Click Generate to create a complete production package with:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Complete Bengali voiceover narration</li>
            <li>Scene-by-scene English image/video prompts</li>
            <li>Camera movements and timing</li>
            <li>Media type labels (static/video)</li>
          </ul>
          <p className="mt-4">
            4. Copy the output and use it with:
          </p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Cartesia for voiceover generation</li>
            <li>Google Flow for image/video generation</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}