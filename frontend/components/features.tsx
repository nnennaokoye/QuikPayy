import { Card, CardContent } from "@/components/ui/card"
import { Zap, Shield, Smartphone, Globe, CreditCard, Users } from "lucide-react"

const features = [
  {
    icon: Zap,
    title: "Gasless Transactions",
    description: "QuikPay can sponsor gas fees for a seamless crypto checkout experience.",
    color: "from-primary to-primary/60",
  },
  {
    icon: Smartphone,
    title: "QR Code Payments",
    description: "Simply scan a QR code or click a payment link. No complex wallet setup or seed phrases required.",
    color: "from-secondary to-secondary/60",
  },
  {
    icon: CreditCard,
    title: "Multi-Token Support",
    description: "Accept payments in USDC, USDT, and WETH. More tokens coming soon to expand your payment options.",
    color: "from-primary to-secondary",
  },
  
]

export function Features() {
  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-card/50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 animate-slide-up">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Why Choose{" "}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">QuikPay</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Experience the future of crypto payments with cutting-edge technology that makes transactions effortless
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-border/50 hover:border-primary/30 animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-6">
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
