import { Hero } from "@/components/hero"
import { Features } from "@/components/features"
import { HowItWorks } from "@/components/how-it-works"
import { CTA } from "@/components/cta"
import { Navigation } from "@/components/navigation"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
      <Navigation />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CTA />
      </main>
    </div>
  )
}
