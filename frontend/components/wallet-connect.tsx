'use client'

import { useEffect, useState } from 'react'
import { useAppKit } from '@reown/appkit/react'
import { useAccount, useDisconnect, useChainId } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Wallet, LogOut } from 'lucide-react'
import { LISK_SEPOLIA } from '@/lib/contract'

export function WalletConnect() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { open } = useAppKit()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const chainId = useChainId()

  const networkName = chainId === LISK_SEPOLIA.id
    ? LISK_SEPOLIA.name
    : chainId
      ? `Chain ${chainId}`
      : 'Unknown'

  // Avoid SSR/client mismatch by waiting until mount
  if (!mounted) {
    return <div className="h-9" />
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/10 text-primary text-sm">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          {networkName}
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/10 text-primary text-sm">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          {`${address.slice(0, 6)}...${address.slice(-4)}`}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => disconnect()}
          className="border-primary/20 hover:bg-primary/10"
        >
          <LogOut className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Disconnect</span>
        </Button>
      </div>
    )
  }

  return (
    <Button
      onClick={() => open()}
      className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 transform hover:scale-105 transition-all duration-200"
    >
      <Wallet className="w-4 h-4 mr-2" />
      Connect Wallet
    </Button>
  )
}
