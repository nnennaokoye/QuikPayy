import { NextResponse } from 'next/server'
import { createWalletClient, createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { LISK_SEPOLIA, QUIKPAY_CONTRACT_ADDRESS, QUIKPAY_ABI } from '@/lib/contract'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { auth: authIn, permit: permitIn } = body || {}

    if (!process.env.SPONSOR_PK) {
      return NextResponse.json({ error: 'Server misconfigured: missing SPONSOR_PK' }, { status: 500 })
    }

    // Basic validation
    if (!authIn || !permitIn) {
      return NextResponse.json({ error: 'Missing auth or permit' }, { status: 400 })
    }

    const auth = {
      receiver: authIn.receiver as `0x${string}`,
      token: authIn.token as `0x${string}`,
      chainId: BigInt(authIn.chainId),
      contractAddress: authIn.contractAddress as `0x${string}`,
      signature: authIn.signature as `0x${string}`,
    }

    if (auth.contractAddress?.toLowerCase() !== QUIKPAY_CONTRACT_ADDRESS.toLowerCase()) {
      return NextResponse.json({ error: 'Invalid contract address' }, { status: 400 })
    }
    if (Number(auth.chainId) !== LISK_SEPOLIA.id) {
      return NextResponse.json({ error: 'Unsupported chainId' }, { status: 400 })
    }

    const permit = {
      owner: permitIn.owner as `0x${string}`,
      token: permitIn.token as `0x${string}`,
      value: BigInt(permitIn.value),
      deadline: BigInt(permitIn.deadline),
      v: Number(permitIn.v),
      r: permitIn.r as `0x${string}`,
      s: permitIn.s as `0x${string}`,
    }

    const account = privateKeyToAccount(process.env.SPONSOR_PK as `0x${string}`)
    const rpcUrl =
      process.env.RPC_URL ||
      process.env.NEXT_PUBLIC_LISK_SEPOLIA_RPC_URL ||
      'https://rpc.sepolia-api.lisk.com'
    const walletClient = createWalletClient({
      account,
      chain: LISK_SEPOLIA as any,
      transport: http(rpcUrl),
    })

    // Simulate first to surface precise revert reason
    const publicClient = createPublicClient({
      chain: LISK_SEPOLIA as any,
      transport: http(rpcUrl),
    })
    // Optional sanity checks: user's balance and token permit validity
    try {
      // Check token balance >= value
      const erc20Abi = [
        { "name": "balanceOf", "type": "function", "stateMutability": "view", "inputs": [{ "name": "", "type": "address" }], "outputs": [{ "name": "", "type": "uint256" }] },
      ] as const
      const bal = await publicClient.readContract({
        address: permit.token,
        abi: erc20Abi as any,
        functionName: 'balanceOf',
        args: [permit.owner],
      }) as bigint
      if (bal < permit.value) {
        return NextResponse.json({ error: 'Insufficient token balance for owner', details: `balance=${bal.toString()} value=${permit.value.toString()}` }, { status: 400 })
      }
    } catch (balErr: any) {
      console.error('gasless-payment balance check error:', balErr)
    }

    try {
      // Simulate ERC20Permit.permit(owner, spender, value, deadline, v, r, s)
      const permitAbi = [
        { "name": "permit", "type": "function", "stateMutability": "nonpayable", "inputs": [
          { "name": "owner", "type": "address" },
          { "name": "spender", "type": "address" },
          { "name": "value", "type": "uint256" },
          { "name": "deadline", "type": "uint256" },
          { "name": "v", "type": "uint8" },
          { "name": "r", "type": "bytes32" },
          { "name": "s", "type": "bytes32" }
        ], "outputs": [] }
      ] as const
      await publicClient.simulateContract({
        chain: LISK_SEPOLIA as any,
        account,
        address: permit.token,
        abi: permitAbi as any,
        functionName: 'permit',
        args: [permit.owner, QUIKPAY_CONTRACT_ADDRESS, permit.value, permit.deadline, permit.v, permit.r, permit.s],
      })
    } catch (permErr: any) {
      console.error('gasless-payment token permit simulate error:', permErr)
      const msg = permErr?.shortMessage || permErr?.message || 'Token permit simulation failed'
      const details = permErr?.cause?.reason || permErr?.cause?.shortMessage || permErr?.cause?.message || permErr?.data
      return NextResponse.json({ error: `Permit simulation revert: ${msg}`, details }, { status: 400 })
    }
    try {
      await publicClient.simulateContract({
        chain: LISK_SEPOLIA as any,
        account,
        address: QUIKPAY_CONTRACT_ADDRESS,
        abi: QUIKPAY_ABI as any,
        functionName: 'payDynamicERC20WithPermit',
        args: [auth, permit],
      })
    } catch (simErr: any) {
      console.error('gasless-payment simulate error:', simErr)
      const msg = simErr?.shortMessage || simErr?.message || 'Simulation failed'
      const details = simErr?.cause?.reason || simErr?.cause?.shortMessage || simErr?.cause?.message || simErr?.data
      return NextResponse.json({ error: `Simulation revert: ${msg}`, details }, { status: 400 })
    }

    // Call QuikPay.payDynamicERC20WithPermit(auth, permit)
    const hash = await walletClient.writeContract({
      chain: LISK_SEPOLIA as any,
      account,
      address: QUIKPAY_CONTRACT_ADDRESS,
      abi: QUIKPAY_ABI as any,
      functionName: 'payDynamicERC20WithPermit',
      args: [auth, permit],
    })

    return NextResponse.json({ hash })
  } catch (e: any) {
    console.error('gasless-payment error:', e)
    const msg = e?.shortMessage || e?.message || 'Unknown error'
    const details = e?.cause?.reason || e?.cause?.shortMessage || e?.cause?.message || e?.data
    return NextResponse.json({ error: msg, details }, { status: 500 })
  }
}