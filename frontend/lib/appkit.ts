'use client'

import { createAppKit } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { LISK_SEPOLIA } from '@/lib/contract'

// Get projectId from env
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

// Build Wagmi adapter with our Lisk Sepolia network
const wagmiAdapter = new WagmiAdapter({
  networks: [
    {
      id: LISK_SEPOLIA.id,
      name: LISK_SEPOLIA.name,
      nativeCurrency: LISK_SEPOLIA.nativeCurrency,
      rpcUrls: LISK_SEPOLIA.rpcUrls,
      blockExplorers: LISK_SEPOLIA.blockExplorers,
      testnet: true
    } as any
  ],
  projectId
})

// Export wagmiConfig for WagmiProvider
export const wagmiConfig = wagmiAdapter.wagmiConfig

// Initialize AppKit once at module load
export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [
    {
      id: LISK_SEPOLIA.id,
      name: LISK_SEPOLIA.name,
      nativeCurrency: LISK_SEPOLIA.nativeCurrency,
      rpcUrls: LISK_SEPOLIA.rpcUrls,
      blockExplorers: LISK_SEPOLIA.blockExplorers,
      testnet: true
    } as any
  ],
  projectId,
  features: {
    email: true,
    socials: [
      'google',
      'x',
      'github',
      'discord',
      'apple',
      'facebook',
      'farcaster'
    ],
    emailShowWallets: true
  },
  allWallets: 'SHOW',
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#4F46E5',
    '--w3m-color-mix': '#4F46E5',
    '--w3m-color-mix-strength': 40,
    '--w3m-border-radius-master': '12px',
    '--w3m-font-family': 'Geist, system-ui, sans-serif'
  }
})
