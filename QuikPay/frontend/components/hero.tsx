"use client"

import { Button } from "@/components/ui/button"
import { Zap, ArrowRight } from "lucide-react"
import Link from "next/link"

export function Hero() {
  return (
    <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Zap className="w-4 h-4 mr-2" />
            Gasless Payments on Lisk
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            Pay with{" "}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Crypto</span>
            <br />
            Like Never Before
          </h1>

          <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto">
          QuikPay makes crypto payments seamless with gasless transactions on the Lisk network. Simply scan and pay in USDC, USDT or WETH — no hassle, no gas.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/pay">
              <Button
                size="lg"
                className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 transform hover:scale-105 transition-all duration-200 text-lg px-8 w-full sm:w-auto"
              >
                Start Paying
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/merchant">
              <Button
                size="lg"
                variant="outline"
                className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200 text-lg px-8 bg-transparent w-full sm:w-auto"
              >
                For Merchants
              </Button>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-8 mt-12 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              No Gas Fees
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              10s Payments
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Multi-Token
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
