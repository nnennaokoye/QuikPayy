import { Card, CardContent } from "@/components/ui/card"
import { QrCode, Smartphone, CheckCircle, ArrowRight } from "lucide-react"

const steps = [
  {
    icon: QrCode,
    title: "Merchant Generates QR",
    description: "Merchant creates a payment QR code or link with the amount and token (USDC, USDT, WETH)",
    step: "01",
  },
  {
    icon: Smartphone,
    title: "Customer Scans & Pays",
    description: "Customer scans the QR code and confirms the payment in seconds",
    step: "02",
  },
  {
    icon: CheckCircle,
    title: "Instant Settlement",
    description: "QuikPay can sponsor gas fees and settles the payment instantly on the Lisk network",
    step: "03",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 animate-slide-up">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            How <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">QuikPay</span>{" "}
            Works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Three simple steps to revolutionize your payment experience
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <div key={index} className="relative animate-slide-up" style={{ animationDelay: `${index * 0.2}s` }}>
              <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-border/50 hover:border-primary/30">
                <CardContent className="p-8 text-center">
                  {/* Step Number */}
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {step.step}
                    </div>
                  </div>

                  {/* Icon */}
                  <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <step.icon className="w-8 h-8 text-primary" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold mb-4 group-hover:text-primary transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                </CardContent>
              </Card>

              {/* Arrow for desktop */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-6 transform -translate-y-1/2">
                  <ArrowRight className="w-6 h-6 text-primary/60" />
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
