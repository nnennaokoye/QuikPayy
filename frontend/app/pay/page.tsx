"use client"

import { useState, useEffect, useRef, type ComponentType } from "react"
import { useAccount } from "wagmi"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QrCode, Link2, Wallet, CheckCircle, Scan, ArrowLeft, AlertCircle, Check } from "lucide-react"


import dynamic from 'next/dynamic'
const BarcodeScanner = dynamic(() =>
  import('react-qr-barcode-scanner').then(m => (m.default ?? (m as any)) as any).catch(() => null as any),
  { ssr: false }
) as unknown as ComponentType<{ onUpdate: (err: any, result: any) => void } | any>
import { Navigation } from "@/components/navigation"
import { WalletConnect } from "@/components/wallet-connect"
import { useQuikPayContract, useBillDetails, type PayAuthorization } from "@/hooks/use-quikpay-contract"
import { TOKENS } from "@/lib/contract"
import { useIsMobile } from "@/hooks/use-mobile"
import { parseUnits } from "viem"
import Link from "next/link"

export default function PayPage() {
  const { address, isConnected } = useAccount()
  const { payBill, isPending, isConfirming, isConfirmed, error, hash } = useQuikPayContract()
  
  const [paymentLink, setPaymentLink] = useState("")
  const [copiedLink, setCopiedLink] = useState(false)
  const [billId, setBillId] = useState("")
  const [paymentData, setPaymentData] = useState<any>(null)
  const [auth, setAuth] = useState<PayAuthorization | null>(null)
  const [tokenAddress, setTokenAddress] = useState<string>("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [activeTab, setActiveTab] = useState("scan")
  const [uiError, setUiError] = useState<string>("")
  const [isEditingAmount, setIsEditingAmount] = useState(false)
  const [scannerActive, setScannerActive] = useState(false)
  const [scannerError, setScannerError] = useState<string>("")
  const isMobile = useIsMobile()
  const scannerActiveRef = useRef(false)

  // Get bill details when billId is available
  const { data: billDetails, isLoading: loadingBill } = useBillDetails(billId)

  // Parse URL parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const billIdParam = urlParams.get("billId")
    const amount = urlParams.get("amount")
    const token = urlParams.get("token") // symbol like USDC, USDT, WETH
    const desc = urlParams.get("desc")
    const receiver = urlParams.get("receiver")
    const chainId = urlParams.get("chainId")
    const contract = urlParams.get("contract")
    const sig = urlParams.get("sig")

    if (billIdParam) {
      setBillId(billIdParam)
      setActiveTab("confirm")
    } else if (receiver && chainId && contract && sig) {
      // Dynamic flow may omit amount; still set auth
      const tAddr = token === 'USDC' ? TOKENS.USDC
        : token === 'USDT' ? TOKENS.USDT
        : token === 'WETH' ? TOKENS.WETH
        : ''
      if (!tAddr) {
        setUiError('Invalid or unsupported token in link')
        return
      }
      setTokenAddress(tAddr)
      setPaymentData({ amount: amount ?? "", token: token ?? "", description: desc || "" })
      setAuth({
        receiver: receiver as `0x${string}`,
        token: tAddr as `0x${string}`,
        chainId: BigInt(chainId),
        contractAddress: contract as `0x${string}`,
        signature: sig as `0x${string}`,
      })
      setActiveTab("confirm")
    } else if (amount && token) {
      setPaymentData({ amount, token, description: desc || "" })
      setActiveTab("confirm")
    }
  }, [])

  // Auto-enable scanner when Scan tab is active on desktop; require tap on mobile.
  useEffect(() => {
    if (activeTab === 'scan') {
      setScannerError("")
      if (isMobile) {
        setScannerActive(false) // wait for user action on mobile
      } else {
        setScannerActive(true)
      }
    } else {
      setScannerActive(false)
    }
  }, [activeTab, isMobile])

  // Keep a ref in sync to avoid setting errors after scanner is stopped
  useEffect(() => {
    scannerActiveRef.current = scannerActive
    if (!scannerActive) {
      
      setScannerError("")
    }
  }, [scannerActive])

  const processPaymentLink = () => {
    try {
      const url = new URL(paymentLink)
      const params = new URLSearchParams(url.search)
      const billIdParam = params.get("billId")
      const amount = params.get("amount")
      const token = params.get("token")
      const desc = params.get("desc")
      const receiver = params.get("receiver")
      const chainId = params.get("chainId")
      const contract = params.get("contract")
      const sig = params.get("sig")

      setUiError("")
      if (billIdParam) {
        setBillId(billIdParam)
        setActiveTab("confirm")
        return
      }

      if (receiver && chainId && contract && sig) {
        const tAddr = token === 'USDC' ? TOKENS.USDC
          : token === 'USDT' ? TOKENS.USDT
          : token === 'WETH' ? TOKENS.WETH
          : ''
        if (!tAddr) {
          setUiError('Invalid or unsupported token in link')
          return
        }
        setTokenAddress(tAddr)
        setPaymentData({ amount: amount ?? "", token: token ?? "", description: desc || "" })
        setAuth({
          receiver: receiver as `0x${string}`,
          token: tAddr as `0x${string}`,
          chainId: BigInt(chainId),
          contractAddress: contract as `0x${string}`,
          signature: sig as `0x${string}`,
        })
        setActiveTab("confirm")
        return
      }

      if (amount && token) {
        setPaymentData({ amount, token, description: desc || "" })
        setActiveTab("confirm")
        return
      }

      setUiError('Invalid link. Please paste the payment link generated by the merchant.')
    } catch (error) {
      setUiError('Invalid link. Please paste the payment link generated by the merchant.')
    }
  }

  const hasAmount = paymentData?.amount !== undefined && paymentData?.amount !== null && paymentData?.amount !== "" && Number(paymentData?.amount) > 0

  const executePayment = async () => {
    setUiError("")
    if (!isConnected) {
      setUiError('Connect your wallet to continue')
      return
    }
    try {
      setIsProcessing(true)

      // Dynamic flow present
      if (auth && hasAmount) {
        {
          if (!tokenAddress || tokenAddress === '0x' as any) {
            setUiError('Missing token address')
            return
          }
          // ERC20 gasless path using EIP-2612
          const owner = address as `0x${string}`
          const spender = auth.contractAddress
          // Read token decimals via eth_call (function selector: 0x313ce567)
          let decimals = 18
          try {
            const decHex = await (window as any).ethereum.request({
              method: 'eth_call',
              params: [{ to: tokenAddress, data: '0x313ce567' }, 'latest'],
            })
            if (decHex && decHex !== '0x') {
              decimals = parseInt(decHex, 16) || 18
            }
          } catch {}
          const value = parseUnits(paymentData.amount, decimals)

          // Get permit nonce via RPC
          const nonce = await (window as any).ethereum.request({
            method: 'eth_call',
            params: [{ to: tokenAddress, data: `0x7ecebe00${owner.slice(2).padStart(64,'0')}` }, 'latest'],
          })
          const nonceBn = (nonce && nonce !== '0x') ? BigInt(nonce) : BigInt(0)

          // deadline in ~1 hour
          const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)

          
          // Resolve token name for EIP-712 domain (defaults for known mocks)
          let tokenName = (() => {
            if (tokenAddress === TOKENS.USDC) return 'Mock USDC'
            if (tokenAddress === TOKENS.USDT) return 'Mock USDT'
            if (tokenAddress === TOKENS.WETH) return 'Mock WETH'
            return 'Token'
          })()
          // Try to read token name via eth_call (function selector: 0x06fdde03)
          try {
            const nameHex = await (window as any).ethereum.request({
              method: 'eth_call',
              params: [{ to: tokenAddress, data: '0x06fdde03' }, 'latest'],
            })
            if (nameHex && nameHex !== '0x') {
              // Decode ABI-encoded string: offset (32), length (32), then data
              const hex = nameHex.startsWith('0x') ? nameHex.slice(2) : nameHex
              if (hex.length >= 128) {
                const len = parseInt(hex.slice(64, 128), 16)
                const strHex = hex.slice(128, 128 + len * 2)
                const bytes = strHex.match(/.{1,2}/g)?.map((b: string) => parseInt(b, 16)) || []
                const decoded = new TextDecoder().decode(new Uint8Array(bytes))
                if (decoded && decoded.trim().length > 0) tokenName = decoded
              }
            }
          } catch {}

          const domain = {
            name: tokenName,
            version: '1',
            chainId: Number(auth.chainId),
            verifyingContract: tokenAddress,
          }
          const types = {
            Permit: [
              { name: 'owner', type: 'address' },
              { name: 'spender', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'nonce', type: 'uint256' },
              { name: 'deadline', type: 'uint256' },
            ],
          }
          const message = { owner, spender, value, nonce: nonceBn, deadline }

          const typedData = {
            types: { EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              { name: 'verifyingContract', type: 'address' },
            ], ...types },
            domain,
            primaryType: 'Permit',
            message,
          }

          const from = owner
          
          const walletTypedData = {
            ...typedData,
            message: {
              ...typedData.message,
              value: value.toString(),
              nonce: nonceBn.toString(),
              deadline: deadline.toString(),
            },
          }
          const sig = await (window as any).ethereum.request({
            method: 'eth_signTypedData_v4',
            params: [from, JSON.stringify(walletTypedData)],
          })

          // split sig
          const r = `0x${sig.slice(2, 66)}`
          const s = `0x${sig.slice(66, 130)}`
          const v = parseInt(sig.slice(130, 132), 16)

          const permit = {
            owner,
            token: tokenAddress as `0x${string}`,
            value,
            deadline,
            v,
            r: r as `0x${string}`,
            s: s as `0x${string}`,
          }

          // Prepare payload with stringified BigInts
          const payload = {
            auth: {
              ...auth,
              chainId: auth.chainId.toString(),
            },
            permit: {
              ...permit,
              value: value.toString(),
              deadline: deadline.toString(),
            },
          }

          const res = await fetch('/api/gasless-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (!res.ok) throw new Error(await res.text())
          const json = await res.json()
          console.log('Sponsored tx hash:', json.hash)
          // Save to local history
          try {
            const arr = JSON.parse(localStorage.getItem('txHistory') || '[]')
            arr.unshift({
              amount: paymentData.amount,
              token: paymentData.token,
              description: paymentData.description || '',
              customer: owner,
              timestamp: new Date().toISOString(),
              txHash: json.hash,
              status: 'Submitted'
            })
            localStorage.setItem('txHistory', JSON.stringify(arr))
          } catch {}
          setIsProcessing(false)
          setIsComplete(true)
          return
        }
      }

      // Fallback to legacy bill flow
      if (!billId) {
        setUiError('Invalid link. Please open the payment link generated by the merchant (it includes an authorization).')
        setIsProcessing(false)
        return
      }

      await payBill(billId)
    } catch (err) {
      console.error('Payment failed:', err)
      setIsProcessing(false)
    }
  }

  const canConfirm = Boolean((auth && hasAmount) || billId)


  // If on Confirm tab without any authorization or billId, show guidance
  useEffect(() => {
    if (activeTab === 'confirm') {
      if (!auth && !billId) {
        setUiError('Missing payment authorization. Please open the full payment link/QR from the merchant (it includes receiver, chainId, contract and signature), or use a bill link with billId.')
      } else {
        setUiError("")
      }
    }
  }, [activeTab, auth, billId])

  // Handle transaction confirmation
  useEffect(() => {
    if (isConfirmed) {
      setIsProcessing(false)
      setIsComplete(true)
    }
  }, [isConfirmed])

  // Stop spinner and surface error if write/confirm errors
  useEffect(() => {
    if (error) {
      setIsProcessing(false)
      setUiError(typeof (error as any)?.message === 'string' ? (error as any).message : 'Transaction failed')
    }
  }, [error])

  useEffect(() => {
    // Only act for attempts that produced a tx hash
    if (!hash) return
    if (!isConfirming && !isConfirmed && isProcessing) {
      setIsProcessing(false)
      setUiError((prev) => prev || 'Transaction failed or was dropped')
    }
  }, [isConfirming, isConfirmed, hash, isProcessing])

  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
        <Navigation />
        <main className="pt-24 pb-12 px-4">
          <div className="max-w-2xl mx-auto text-center">
            <div className="mb-6 text-left">
              <Link href="/">
                <Button variant="ghost" className="flex items-center space-x-2 hover:bg-primary/10">
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Home</span>
                </Button>
              </Link>
            </div>

            <div className="mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-foreground mb-4">Payment Successful!</h1>
              <p className="text-xl text-muted-foreground">Your gasless transaction has been completed</p>
            </div>

            <Card className="border-2 border-green-200 bg-green-50/50">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-bold text-green-600">
                      {paymentData?.amount} {paymentData?.token}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Network:</span>
                    <span className="font-semibold">Lisk Sepolia</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gas Fees:</span>
                    <span className="font-semibold text-green-600">$0.00 (Gasless)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={() => (window.location.href = "/")}
              className="mt-8 bg-gradient-to-r from-primary to-secondary"
            >
              Back to Home
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-card to-background">
      <Navigation />

      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Link href="/">
              <Button variant="ghost" className="flex items-center space-x-2 hover:bg-primary/10">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Home</span>
              </Button>
            </Link>
          </div>

          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center space-x-2 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-secondary to-primary rounded-xl flex items-center justify-center animate-pulse-glow">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
                Make Payment
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Scan QR code or enter payment link for gasless crypto transactions
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="scan" className="flex items-center space-x-2">
                  <Scan className="w-4 h-4" />
                  <span>Scan QR</span>
                </TabsTrigger>
                <TabsTrigger value="link" className="flex items-center space-x-2">
                  <Link2 className="w-4 h-4" />
                  <span>Enter Link</span>
                </TabsTrigger>
                <TabsTrigger value="confirm" className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Confirm</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="scan" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <QrCode className="w-5 h-5 text-primary" />
                      <span>Scan QR Code</span>
                    </CardTitle>
                    <CardDescription>Point your camera at the merchant's QR code</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-center py-6">
                      {BarcodeScanner ? (
                        <div className="w-full max-w-sm">
                          {(!scannerActive) && (
                            <div className="space-y-3 text-center">
                              {scannerError && (
                                <p className="text-sm text-red-600">{scannerError}</p>
                              )}
                              <Button onClick={() => { setScannerError(""); setScannerActive(true) }} className="w-full">
                                Start Scanner
                              </Button>
                            </div>
                          )}
                          {scannerActive && (
                            <BarcodeScanner
                              width={360}
                              height={260}
                              facingMode="environment"
                              onError={(err: any) => {
                                if (!scannerActiveRef.current) return
                                if (err) setScannerError(typeof err === 'string' ? err : 'Camera error')
                              }}
                              onUpdate={(err: any, result: any) => {
                                if (err) return
                                try {
                                  const text = result?.getText?.() || result?.text
                                  if (text) {
                                    setPaymentLink(text)
                                    setActiveTab('link')
                                    setScannerActive(false)
                                  }
                                } catch {}
                              }}
                            />
                          )}
                          {scannerActive && (
                            <div className="mt-3 flex justify-center">
                              <Button variant="outline" onClick={() => { setScannerActive(false); setScannerError("") }}>Stop Scanner</Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Scan className="w-16 h-16 text-primary mx-auto mb-4 animate-pulse" />
                          <p className="text-muted-foreground">Camera Scanner unavailable</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="link" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Link2 className="w-5 h-5 text-secondary" />
                      <span>Paste or Open Link</span>
                    </CardTitle>
                    <CardDescription>Paste a payment link or open the scanned one</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Payment Link</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://..."
                          value={paymentLink}
                          onChange={(e) => { setPaymentLink(e.target.value); setCopiedLink(false) }}
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={async () => { await navigator.clipboard.writeText(paymentLink); setCopiedLink(true); setTimeout(()=>setCopiedLink(false), 1200) }}
                          className="hover:bg-primary/10"
                        >
                          {copiedLink ? <Check className="w-4 h-4 text-green-600"/> : <>
                            {/* Copy icon */}
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                              <path d="M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                            </svg>
                          </>}
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <Button
                        onClick={() => {
                          try {
                            const url = new URL(paymentLink)
                            const params = new URLSearchParams(url.search)
                            // update url for shareability
                            window.history.replaceState(null, "", `/pay?${params.toString()}`)
                          } catch {}
                          processPaymentLink()
                        }}
                      >
                        Process Payment Link
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="confirm" className="mt-6">
                {!isConnected ? (
                  <Card>
                    <CardContent className="text-center py-12">
                      <Wallet className="w-16 h-16 text-primary mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
                      <p className="text-muted-foreground mb-6">You need to connect your wallet to make payments</p>
                      <WalletConnect />
                    </CardContent>
                  </Card>
                ) : (paymentData || billDetails) ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span>Confirm Payment</span>
                      </CardTitle>
                      <CardDescription>Review payment details before confirming</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Payment Details */}
                      <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Amount:</span>
                          {auth && (!hasAmount || isEditingAmount) ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                placeholder="Enter amount"
                                value={paymentData.amount}
                                onChange={(e) => setPaymentData((p:any)=>({ ...p, amount: e.target.value }))}
                                onFocus={() => setIsEditingAmount(true)}
                                onBlur={() => setIsEditingAmount(false)}
                                className="w-40"
                              />
                              <span className="text-lg font-semibold">{paymentData.token}</span>
                            </div>
                          ) : (
                            <span className="text-2xl font-bold text-foreground">
                              {paymentData.amount} {paymentData.token}
                            </span>
                          )}
                        </div>
                        {paymentData.description && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Description:</span>
                            <span className="font-semibold">{paymentData.description}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Network:</span>
                          <span className="font-semibold">Lisk Sepolia</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Gas Fees:</span>
                          <span className="font-semibold text-green-600">$0.00 (Gasless)</span>
                        </div>
                      </div>

                      {uiError && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 text-red-700 border border-red-200">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm">{uiError}</span>
                        </div>
                      )}

                      {/* Tip banner about gaslessness */}
                      <div className="text-sm text-muted-foreground bg-muted/40 rounded-md p-3">
                        <span>
                          This payment is sponsored by QuikPay. Your wallet will not pay gas fees.
                        </span>
                      </div>

                      <Button
                        onClick={executePayment}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transform hover:scale-105 transition-all duration-200"
                        disabled={!canConfirm || isProcessing}
                      >
                        {isProcessing ? (
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Processing Payment...</span>
                          </div>
                        ) : canConfirm ? (
                          `Pay ${paymentData?.amount ?? ''} ${paymentData?.token ?? ''}`
                        ) : (
                          'Confirm'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="text-center py-12">
                      <CheckCircle className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                      <p className="text-muted-foreground">Scan a QR code or enter a payment link to continue</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  )
}