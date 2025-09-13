"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, Zap, Users, TrendingUp } from "lucide-react"

export function CTA() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="max-w-7xl mx-auto">
        {/* Main CTA */}
        <div className="text-center mb-16 animate-slide-up">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Ready to Transform Your{" "}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Payment Experience?
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">
            Join thousands of merchants and customers already using QuikPay for seamless, gasless crypto payments on
            the Lisk network.
          </p>

        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {[
            { icon: Zap, label: "Transactions", value: "10,000+", color: "from-primary to-primary/60" },
            { icon: Users, label: "Active Merchants", value: "500+", color: "from-secondary to-secondary/60" },
            { icon: TrendingUp, label: "Success Rate", value: "99.9%", color: "from-primary to-secondary" },
          ].map((stat, index) => (
            <Card
              key={index}
              className="text-center group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <CardContent className="p-6">
                <div
                  className={`w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                >
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-muted-foreground font-medium">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Final CTA Card */}
        <Card className="bg-gradient-to-r from-primary to-secondary text-white animate-slide-up">
          <CardContent className="p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Join the Future of Crypto Payments</h2>
            <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
              Whether you're a business ready to accept crypto payments or a customer wanting seamless transactions, QuikPay makes it simple and gasless.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}