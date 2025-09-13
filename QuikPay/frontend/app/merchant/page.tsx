"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useAccount } from "wagmi"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QrCode, Copy, Link2, Zap, ArrowLeft, History, FileText, Wallet, Share2, Download, Check } from "lucide-react"
import { Navigation } from "@/components/navigation"
import { WalletConnect } from "@/components/wallet-connect"
import { TOKENS, QUIKPAY_CONTRACT_ADDRESS, LISK_SEPOLIA } from "@/lib/contract"
import { useExpiryWindow } from "@/hooks/use-quikpay-contract"
import { formatDuration } from "@/lib/utils"
import { encodeAbiParameters, keccak256, createPublicClient, http, parseAbiItem, formatUnits } from "viem"
import Link from "next/link"
import QRCode from "react-qr-code"
import QRCodeLib from "qrcode"

export default function MerchantPage() {
  const { address, isConnected, chainId } = useAccount()

  const [amount, setAmount] = useState("")
  const [token, setToken] = useState("USDC")
  const [description, setDescription] = useState("")
  const [qrGenerated, setQrGenerated] = useState(false)
  const [paymentLink, setPaymentLink] = useState("")
  const [billId, setBillId] = useState("")
  const [activeTab, setActiveTab] = useState("create")
  const qrRef = useRef<SVGSVGElement | null>(null)
  const [copied, setCopied] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  type CreatedPayment = { id: number; amount: string; token: string; description: string; link: string; created: string; status: string; createdAtSec?: number }
  const [createdPayments, setCreatedPayments] = useState<CreatedPayment[]>([])
  const [transactionHistory, setTransactionHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  // ticker to update countdowns on Created tab
  const [nowSec, setNowSec] = useState(Math.floor(Date.now() / 1000))
  const { data: expiryWindow } = useExpiryWindow()

  // viem public client for reading chain logs
  const publicClient = useMemo(() => {
    return createPublicClient({
      chain: LISK_SEPOLIA as any,
      transport: http(LISK_SEPOLIA.rpcUrls.default.http[0])
    })
  }, [])

  // Reverse map token address -> symbol/decimals
  const tokenMeta: Record<string, { symbol: string; decimals: number }> = {
    [TOKENS.USDC.toLowerCase()]: { symbol: 'USDC', decimals: 6 },
    [TOKENS.USDT.toLowerCase()]: { symbol: 'USDT', decimals: 6 },
    [TOKENS.WETH.toLowerCase()]: { symbol: 'WETH', decimals: 18 },
  }

  const eDynamicErc20 = parseAbiItem('event DynamicErc20Paid(address indexed receiver, address indexed payer, address indexed token, uint256 amount, uint256 timestamp)')
  const eBillPaid = parseAbiItem('event BillPaid(bytes32 indexed billId, address indexed payer, address indexed receiver, address token, uint256 amount, uint256 timestamp)')

  const fetchOnChainHistory = async () => {
    if (!address) return
    try {
      setLoadingHistory(true)
      const latest = await publicClient.getBlockNumber()
      // Use a safe block step to avoid provider range limits
      const maxLookback = BigInt(90000)
      const step = BigInt(9000)
      const startBlock = latest > maxLookback ? latest - maxLookback : BigInt(0)

      let erc20Logs: any[] = []
      let billLogs: any[] = []

      const one = BigInt(1)
      for (let from = startBlock; from <= latest; from += step) {
        const to = (from + step - one) > latest ? latest : (from + step - one)
        // Fetch 2 event types in parallel per batch
        const [e20, ebill] = await Promise.all([
          publicClient.getLogs({
            address: QUIKPAY_CONTRACT_ADDRESS,
            event: eDynamicErc20,
            args: { receiver: address },
            fromBlock: from,
            toBlock: to,
          }),
          publicClient.getLogs({
            address: QUIKPAY_CONTRACT_ADDRESS,
            event: eBillPaid,
            args: { receiver: address },
            fromBlock: from,
            toBlock: to,
          }),
        ])
        erc20Logs = erc20Logs.concat(e20 as any)
        billLogs = billLogs.concat(ebill as any)
      }

      const onchain = [
        ...erc20Logs.map((log: any) => {
          const tAddr = (log.args.token as string).toLowerCase()
          const meta = tokenMeta[tAddr] || { symbol: 'TOKEN', decimals: 18 }
          return {
            id: `${log.blockNumber.toString()}-${log.logIndex}`,
            bn: Number(log.blockNumber),
            li: Number(log.logIndex),
            amount: formatUnits(log.args.amount as bigint, meta.decimals),
            token: meta.symbol,
            description: 'Dynamic ERC20 payment',
            customer: log.args.payer as string,
            status: 'Success',
            timestamp: new Date(Number(log.args.timestamp) * 1000).toLocaleString(),
            txHash: log.transactionHash as string,
          }
        }),
        ...billLogs.map((log: any) => {
          const tAddr = (log.args.token as string).toLowerCase()
          const meta = tokenMeta[tAddr] || { symbol: 'TOKEN', decimals: 18 }
          return {
            id: `${log.blockNumber.toString()}-${log.logIndex}`,
            bn: Number(log.blockNumber),
            li: Number(log.logIndex),
            amount: formatUnits(log.args.amount as bigint, meta.decimals),
            token: meta.symbol,
            description: 'Bill payment',
            customer: log.args.payer as string,
            status: 'Success',
            timestamp: new Date(Number(log.args.timestamp) * 1000).toLocaleString(),
            txHash: log.transactionHash as string,
          }
        }),
      ]

      // Optionally merge with local entries
      let merged = onchain
      try {
        const local = JSON.parse(localStorage.getItem('txHistory') || '[]')
        const localForMe = local.filter((x: any) => !x.receiver || String(x.receiver).toLowerCase() === String(address).toLowerCase())
        merged = [
          ...onchain,
          ...localForMe.map((x: any, i: number) => ({
            id: `local-${i}-${x.txHash || Date.now()}`,
            amount: x.amount,
            token: x.token,
            description: x.description || 'Payment',
            customer: x.customer,
            status: x.status || 'Submitted',
            timestamp: x.timestamp || '',
            txHash: x.txHash,
          })),
        ]
      } catch {}

      merged.sort((a: any, b: any) => {
        const bnb = typeof b.bn === 'number' ? b.bn : 0
        const anb = typeof a.bn === 'number' ? a.bn : 0
        if (bnb !== anb) return bnb - anb
        const bli = typeof b.li === 'number' ? b.li : 0
        const ali = typeof a.li === 'number' ? a.li : 0
        if (bli !== ali) return bli - ali
        // fallback to timestamp desc if needed
        return (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0)
      })
      setTransactionHistory(merged)
    } catch (e) {
      console.error('Failed to fetch on-chain history', e)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('createdPayments') || '[]')
      setCreatedPayments(stored)
    } catch {}
    try {
      const tx = JSON.parse(localStorage.getItem('txHistory') || '[]')
      setTransactionHistory(tx)
    } catch {}
  }, [])

  // Refresh on-chain history when merchant connects or address changes
  useEffect(() => {
    if (isConnected && address) {
      fetchOnChainHistory()
    }
  }, [isConnected, address])

  // Tick every second only when Created tab is active
  useEffect(() => {
    if (activeTab !== 'created') return
    const t = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [activeTab])

  // Real-time subscription for new events on History tab
  useEffect(() => {
    if (!isConnected || !address || activeTab !== 'history') return
    const unsubs: Array<() => void> = []
    try {
      const onLogs = (logs: any[]) => {
        if (!logs?.length) return
        const mapped = logs.map((log: any) => {
          if (log.eventName === 'DynamicErc20Paid') {
            const tAddr = (log.args.token as string).toLowerCase()
            const meta = tokenMeta[tAddr] || { symbol: 'TOKEN', decimals: 18 }
            return {
              id: `${log.blockNumber.toString()}-${log.logIndex}`,
              bn: Number(log.blockNumber),
              li: Number(log.logIndex),
              amount: formatUnits(log.args.amount as bigint, meta.decimals),
              token: meta.symbol,
              description: 'Dynamic ERC20 payment',
              customer: log.args.payer as string,
              status: 'Success',
              timestamp: new Date(Number(log.args.timestamp) * 1000).toLocaleString(),
              txHash: log.transactionHash as string,
            }
          }
        })
        // de-dupe by id
        setTransactionHistory(prev => {
          const ids = new Set(prev.map((x:any)=>x.id))
          const merged = [...mapped.filter(m=>m && !ids.has(m.id)), ...prev]
          merged.sort((a: any, b: any) => {
            const bnb = typeof b.bn === 'number' ? b.bn : 0
            const anb = typeof a.bn === 'number' ? a.bn : 0
            if (bnb !== anb) return bnb - anb
            const bli = typeof b.li === 'number' ? b.li : 0
            const ali = typeof a.li === 'number' ? a.li : 0
            if (bli !== ali) return bli - ali
            return (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0)
          })
          return merged
        })
      }
      // Subscribe ERC20
      const un1 = publicClient.watchEvent({
        address: QUIKPAY_CONTRACT_ADDRESS,
        event: eDynamicErc20,
        args: { receiver: address },
        onLogs,
        onError: (e)=>console.warn('watch erc20 err', e),
        poll: true,
        pollingInterval: 8000,
      })
      unsubs.push(un1)
      // Subscribe BillPaid
      const un3 = publicClient.watchEvent({
        address: QUIKPAY_CONTRACT_ADDRESS,
        event: eBillPaid,
        args: { receiver: address },
        onLogs: (logs:any[]) => {
          if (!logs?.length) return
          const mapped = logs.map((log:any) => {
            const tAddr = (log.args.token as string).toLowerCase()
            const meta = tokenMeta[tAddr] || { symbol: 'TOKEN', decimals: 18 }
            return {
              id: `${log.blockNumber.toString()}-${log.logIndex}`,
              bn: Number(log.blockNumber),
              li: Number(log.logIndex),
              amount: formatUnits(log.args.amount as bigint, meta.decimals),
              token: meta.symbol,
              description: 'Bill payment',
              customer: log.args.payer as string,
              status: 'Success',
              timestamp: new Date(Number(log.args.timestamp) * 1000).toLocaleString(),
              txHash: log.transactionHash as string,
            }
          })
          setTransactionHistory(prev => {
            const ids = new Set(prev.map((x:any)=>x.id))
            const merged = [...mapped.filter(m=>!ids.has(m.id)), ...prev]
            merged.sort((a: any, b: any) => {
              const bnb = typeof b.bn === 'number' ? b.bn : 0
              const anb = typeof a.bn === 'number' ? a.bn : 0
              if (bnb !== anb) return bnb - anb
              const bli = typeof b.li === 'number' ? b.li : 0
              const ali = typeof a.li === 'number' ? a.li : 0
              if (bli !== ali) return bli - ali
              return (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0)
            })
            return merged
          })
        },
        onError: (e)=>console.warn('watch bill err', e),
        poll: true,
        pollingInterval: 8000,
      })
      unsubs.push(un3)
    } catch (e) {
      console.warn('Failed to subscribe to events', e)
    }
    return () => { unsubs.forEach(u=>{ try{ u() }catch{} }) }
  }, [isConnected, address, activeTab])

  const generatePayment = async () => {
    if (!token || !isConnected || !address) return
    try {
      const tokenAddress = token === 'USDC' ? TOKENS.USDC : token === 'USDT' ? TOKENS.USDT : TOKENS.WETH
      const selectedChainId = chainId ?? LISK_SEPOLIA.id

      // Build EIP-191 signed auth: keccak256(abi.encode(receiver, token, chainId, contractAddress))
      const encoded = encodeAbiParameters(
        [{ name: 'receiver', type: 'address' }, { name: 'token', type: 'address' }, { name: 'chainId', type: 'uint256' }, { name: 'contractAddress', type: 'address' }],
        [address, tokenAddress, BigInt(selectedChainId), QUIKPAY_CONTRACT_ADDRESS]
      )
      const innerHash = keccak256(encoded)

      // Request signature from connected wallet using personal_sign
      const sig = await (window as any).ethereum.request({
        method: 'personal_sign',
        params: [innerHash, address],
      })

      const amtParam = amount ? `amount=${encodeURIComponent(amount)}&` : ""
      const link = `${window.location.origin}/pay?${amtParam}token=${encodeURIComponent(token)}&receiver=${address}&chainId=${selectedChainId}&contract=${QUIKPAY_CONTRACT_ADDRESS}&sig=${sig}`
      setPaymentLink(link)
      setQrGenerated(true)

      // persist created payment
      try {
        const nowMs = Date.now()
        const entry: CreatedPayment = {
          id: nowMs,
          amount: amount || "",
          token,
          description,
          link,
          created: new Date(nowMs).toLocaleString(),
          status: "Active",
          createdAtSec: Math.floor(nowMs / 1000),
        }
        const arr: CreatedPayment[] = JSON.parse(localStorage.getItem('createdPayments') || '[]')
        arr.unshift(entry)
        localStorage.setItem('createdPayments', JSON.stringify(arr))
        setCreatedPayments(arr)
      } catch {}
    } catch (err) {
      console.error('Failed to generate payment link:', err)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(paymentLink)
  }

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'QuikPay Payment', text: description || 'Pay with QuikPay', url: paymentLink })
      } else {
        copyLink()
      }
    } catch {}
  }

  // Generate a PNG blob directly from the paymentLink using 'qrcode' 
  const generatePngBlobFromLink = async (link: string): Promise<Blob> => {
    const dataUrl = await QRCodeLib.toDataURL(link, {
      errorCorrectionLevel: 'H',
      margin: 4, 
      scale: 8,
      color: { dark: '#000000', light: '#FFFFFFFF' },
    })
    const res = await fetch(dataUrl)
    return await res.blob()
  }

  const downloadQR = async () => {
    try {
      if (!paymentLink) return
      const pngBlob = await generatePngBlobFromLink(paymentLink)
      const url = URL.createObjectURL(pngBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `quikpay-qr-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }

  // Share QR code as a file 
  const shareQR = async () => {
    try {
      if (!paymentLink) return
      const pngBlob = await generatePngBlobFromLink(paymentLink)
      const file = new File([pngBlob], `quikpay-qr-${Date.now()}.png`, { type: 'image/png' })
      const navAny: any = navigator
      if (navAny?.canShare && navAny.canShare({ files: [file] }) && navAny?.share) {
        await navAny.share({ files: [file], title: 'QuikPay QR Code', text: description || 'Scan to pay' })
      } else {
        // fallback to download PNG
        const url = URL.createObjectURL(pngBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `quikpay-qr-${Date.now()}.png`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {}
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
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center animate-pulse-glow">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Merchant Dashboard
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Generate QR codes and payment links for gasless crypto transactions
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); if (v === 'history') fetchOnChainHistory() }} className="w-full">
            <TabsList className="w-full mb-6 gap-2 flex flex-nowrap overflow-x-auto whitespace-nowrap h-auto items-stretch">
              <TabsTrigger value="create" className="flex items-center space-x-2 flex-none h-auto whitespace-normal leading-tight py-2">
                <QrCode className="w-4 h-4" />
                <span>Create Payment</span>
              </TabsTrigger>
              <TabsTrigger value="created" className="flex items-center space-x-2 flex-none h-auto whitespace-normal leading-tight py-2">
                <FileText className="w-4 h-4" />
                <span>Created Codes</span>
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center space-x-2 flex-none h-auto whitespace-normal leading-tight py-2">
                <History className="w-4 h-4" />
                <span>Transaction History</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create">
              {!isConnected ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Wallet className="w-16 h-16 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Connect Your Wallet</h3>
                    <p className="text-muted-foreground mb-6">You need to connect your wallet to create payment requests</p>
                    <WalletConnect />
                  </CardContent>
                </Card>
              ) : (
                <div className="grid lg:grid-cols-2 gap-8">
                  {/* Payment Form */}
                  <Card className="border-2 border-border/50 hover:border-primary/20 transition-all duration-300">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <QrCode className="w-5 h-5 text-primary" />
                        <span>Create Payment Request</span>
                      </CardTitle>
                      <CardDescription>Set up your payment details to generate QR code and link</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount (Optional)</Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="text-lg"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="token">Token</Label>
                      <Select value={token} onValueChange={setToken}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select token" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USDC">USDC</SelectItem>
                          <SelectItem value="USDT">USDT</SelectItem>
                          <SelectItem value="WETH">WETH</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description (Optional)</Label>
                      <Input
                        id="description"
                        placeholder="Payment for..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>

                    <Button
                      onClick={generatePayment}
                      className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 transform hover:scale-105 transition-all duration-200"
                      disabled={!token}
                    >
                      Generate Payment
                    </Button>
                  </CardContent>
                  </Card>

                  {/* QR Code & Link Display */}
                <Card className="border-2 border-border/50 hover:border-secondary/20 transition-all duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Link2 className="w-5 h-5 text-secondary" />
                      <span>Payment QR & Link</span>
                    </CardTitle>
                    <CardDescription>Share this QR code or link with your customers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {qrGenerated ? (
                      <div className="space-y-6">
                        {/* QR Code */}
                        <div className="flex flex-col items-center gap-3">
                          <div className="bg-white p-6 rounded-xl shadow-sm mx-auto">
                            <QRCode value={paymentLink} size={320} level="H" fgColor="#000000" bgColor="#FFFFFF"
                              ref={qrRef as any}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={downloadQR} className="gap-2"><Download className="w-4 h-4"/>Download</Button>
                            <Button variant="outline" onClick={shareQR} className="gap-2"><Share2 className="w-4 h-4"/>Share Code</Button>
                          </div>
                        </div>

                        {/* Payment Link */}
                        <div className="space-y-2">
                          <Label>Payment Link</Label>
                          <div className="flex space-x-2 items-center">
                            <Input value={paymentLink} readOnly className="font-mono text-sm" />
                            <Button
                              onClick={async () => { await navigator.clipboard.writeText(paymentLink); setCopied(true); setTimeout(()=>setCopied(false), 1200) }}
                              variant="outline"
                              size="icon"
                              className="hover:bg-primary/10 bg-transparent"
                              aria-label="Copy link"
                            >
                              {copied ? <Check className="w-4 h-4 text-green-600"/> : <Copy className="w-4 h-4" />}
                            </Button>
                            <Button onClick={shareLink} variant="outline" size="icon" className="hover:bg-secondary/10 bg-transparent" aria-label="Share link"><Share2 className="w-4 h-4"/></Button>
                          </div>
                        </div>

                        {/* Payment Details */}
                        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount:</span>
                            <span className="font-semibold">
                              {amount} {token}
                            </span>
                          </div>
                          {description && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Description:</span>
                              <span className="font-semibold">{description}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Network:</span>
                            <span className="font-semibold">Lisk Sepolia</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <QrCode className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                        <p className="text-muted-foreground">
                          Fill in the payment details to generate QR code and link
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="created">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <span>Created Payment Codes</span>
                  </CardTitle>
                  <CardDescription>View and manage your generated payment requests</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {createdPayments.length === 0 && (
                      <p className="text-muted-foreground">No created codes yet. Generate a payment to see it here.</p>
                    )}
                    {createdPayments.map((payment) => {
                      // derive seconds remaining using robust numeric timestamp
                      const createdTs = payment.createdAtSec ?? Math.floor((payment.id || 0) / 1000)
                      const exp = Number(expiryWindow ?? 0n)
                      const secondsElapsed = nowSec - createdTs
                      const secondsRemaining = exp > 0 && createdTs > 0 ? Math.max(0, exp - Math.max(0, secondsElapsed)) : undefined
                      const isExpired = secondsRemaining !== undefined && secondsRemaining === 0

                      return (
                      <div key={payment.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">
                              {payment.amount} {payment.token}
                            </h3>
                            <p className="text-muted-foreground">{payment.description}</p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              {secondsRemaining !== undefined && isExpired ? (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Expired</span>
                              ) : (
                                <>
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      payment.status === "Active"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-blue-100 text-blue-800"
                                    }`}
                                  >
                                    {payment.status}
                                  </span>
                                  {secondsRemaining !== undefined && (
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                      Expires in {formatDuration(secondsRemaining)}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{payment.created}</p>
                          </div>
                        </div>
                        <div className="flex space-x-2 items-center">
                          <Input value={payment.link} readOnly className="font-mono text-sm" />
                          <Button
                            onClick={async () => { await navigator.clipboard.writeText(payment.link); setCopiedId(payment.id); setTimeout(()=>setCopiedId(null), 1200) }}
                            variant="outline"
                            size="icon"
                            className="hover:bg-primary/10"
                          >
                            {copiedId === payment.id ? <Check className="w-4 h-4 text-green-600"/> : <Copy className="w-4 h-4" />}
                          </Button>
                          <Button onClick={() => navigator.share?.({ title:'QuikPay Payment', url: payment.link })}
                            variant="outline" size="icon" className="hover:bg-secondary/10">
                            <Share2 className="w-4 h-4"/>
                          </Button>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <History className="w-5 h-5 text-secondary" />
                    <span>Transaction History</span>
                  </CardTitle>
                  <CardDescription>View completed payments and transaction details</CardDescription>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">Live</span>
                    <a className="text-xs text-muted-foreground" href={LISK_SEPOLIA.blockExplorers.default.url} target="_blank" rel="noreferrer">Explorer</a>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button variant="outline" onClick={fetchOnChainHistory} disabled={loadingHistory} className="gap-2">
                      {loadingHistory ? 'Refreshing...' : 'Refresh'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(!loadingHistory && transactionHistory.length === 0) && (
                      <p className="text-muted-foreground">No transactions yet. They will appear after customers pay.</p>
                    )}
                    {loadingHistory && (
                      <p className="text-muted-foreground">Loading on-chain history...</p>
                    )}
                    {transactionHistory.map((tx, idx) => (
                      <div key={tx.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">
                              {tx.amount} {tx.token}
                            </h3>
                            <p className="text-muted-foreground">{tx.description}</p>
                            <p className="text-sm text-muted-foreground break-all">From: {tx.customer}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">{tx.timestamp}</p>
                            <a href={`${LISK_SEPOLIA.blockExplorers.default.url}/tx/${tx.txHash}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">View Tx</a>
                          </div>
                        </div>
                        <div className="bg-muted/30 rounded p-2 overflow-hidden">
                          <p className="text-sm font-mono text-muted-foreground break-all">Tx Hash: {tx.txHash}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}