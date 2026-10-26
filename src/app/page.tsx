import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, Lock, Repeat, MessageSquare, Download } from "lucide-react"
import Link from "next/link"

const features = [
  {
    icon: Sparkles,
    title: "Story Bible with Visual & Voice Locks",
    description:
      "Detects characters and locations, locking exact visual facts and voice attributes for consistent results.",
  },
  {
    icon: Lock,
    title: "Code-Assembled Prompts",
    description:
      "Prompts are assembled deterministically by code (never hallucinated by the model), inserting locks verbatim.",
  },
  {
    icon: Repeat,
    title: "Consistency Chaining",
    description:
      "Extract the last frame of a generated clip directly and send it to the next scene as its starting reference.",
  },
  {
    icon: MessageSquare,
    title: "Chat Editing",
    description:
      "Natural language planning (e.g. 'Change Rina's saree to green from now on') updates all affected prompts automatically.",
  },
  {
    icon: Download,
    title: "Flexible Export",
    description:
      "Download prompts as formatted .txt, full plan as .json, or a .zip archive with all prompts and media assets.",
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="container mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl font-bold mb-6">
          Turn a story into consistent video clips for{" "}
          <span className="text-primary">Google Flow</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Lock characters, voices, and locations. Generate production-ready prompts with code — never hallucinated by the model.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/studio/editor">
            <Button size="lg">Start Creating</Button>
          </Link>
          <Link href="/studio/editor">
            <Button size="lg" variant="secondary">Learn More</Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Everything you need for consistent video generation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="bg-card border-border">
              <CardHeader>
                <feature.icon className="h-10 w-10 text-primary mb-4" />
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-muted-foreground">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl font-bold mb-6">Ready to bring your story to life?</h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Start creating your video production plan in seconds.
        </p>
        <Link href="/studio/editor">
          <Button size="lg">Get Started</Button>
        </Link>
      </section>
    </div>
  )
}
