import { NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { LISK_SEPOLIA, TOKENS } from '@/lib/contract'

export const runtime = 'nodejs'

const CLAIM_AMOUNT_USDC = 50n * 10n ** 6n // 50 mUSDC (6 decimals)

// Simple in-memory rate limit map (per server instance). For production, replace with durable storage.
const lastClaimByAddress = new Map<string, number>()
// Enforce a fixed 24-hour cooldown between claims per address
const CLAIM_COOLDOWN_MS = 24 * 60 * 60 * 1000

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const address = body?.address as string | undefined

    if (!address || !address.startsWith('0x') || address.length !== 42) {
      return NextResponse.json({ error: 'Invalid or missing address' }, { status: 400 })
    }

    const pk = process.env.FAUCET_PK as `0x${string}` | undefined
    if (!pk) {
      return NextResponse.json({ error: 'Server misconfigured: missing FAUCET_PK' }, { status: 500 })
    }

    // Basic per-address cooldown. Mark as claimed immediately after passing the check
    // to avoid multiple successful claims from rapid double-clicks or concurrent requests.
    const now = Date.now()
    const key = address.toLowerCase()
    const last = lastClaimByAddress.get(key) || 0
    if (now - last < CLAIM_COOLDOWN_MS) {
      const remainingMs = CLAIM_COOLDOWN_MS - (now - last)
      const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000))
      return NextResponse.json(
        { error: `Claim too soon. Try again in ~${remainingHours}h.` },
        { status: 429 },
      )
    }

    // Reserve this claim window up-front
    lastClaimByAddress.set(key, now)

    const account = privateKeyToAccount(pk)
    const rpcUrl =
      process.env.RPC_URL ||
      process.env.NEXT_PUBLIC_LISK_SEPOLIA_RPC_URL ||
      'https://rpc.sepolia-api.lisk.com'

    const walletClient = createWalletClient({
      account,
      chain: LISK_SEPOLIA as any,
      transport: http(rpcUrl),
    })

    const publicClient = createPublicClient({
      chain: LISK_SEPOLIA as any,
      transport: http(rpcUrl),
    })

    const erc20Abi = [
      {
        name: 'mint',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [],
      },
    ] as const

    // Optional: simulate first to surface revert reasons
    try {
      await publicClient.simulateContract({
        chain: LISK_SEPOLIA as any,
        account,
        address: TOKENS.USDC as `0x${string}`,
        abi: erc20Abi as any,
        functionName: 'mint',
        args: [address as `0x${string}`, CLAIM_AMOUNT_USDC],
      })
    } catch (simErr: any) {
      console.error('claim-usdc simulate error:', simErr)
      const msg = simErr?.shortMessage || simErr?.message || 'Simulation failed'
      const details =
        simErr?.cause?.reason ||
        simErr?.cause?.shortMessage ||
        simErr?.cause?.message ||
        simErr?.data
      return NextResponse.json({ error: `Simulation revert: ${msg}`, details }, { status: 400 })
    }

    const hash = await walletClient.writeContract({
      chain: LISK_SEPOLIA as any,
      account,
      address: TOKENS.USDC as `0x${string}`,
      abi: erc20Abi as any,
      functionName: 'mint',
      args: [address as `0x${string}`, CLAIM_AMOUNT_USDC],
    })

    return NextResponse.json({ hash })
  } catch (e: any) {
    console.error('claim-usdc error:', e)
    const msg = e?.shortMessage || e?.message || 'Unknown error'
    const details =
      e?.cause?.reason ||
      e?.cause?.shortMessage ||
      e?.cause?.message ||
      e?.data
    return NextResponse.json({ error: msg, details }, { status: 500 })
  }
}
