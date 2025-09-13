'use client'

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { QUIKPAY_CONTRACT_ADDRESS, QUIKPAY_ABI } from '@/lib/contract'
import { parseEther, type Address } from 'viem'

export type PayAuthorization = {
  receiver: Address
  token: Address
  chainId: bigint
  contractAddress: Address
  signature: `0x${string}`
}

// Hook to read expiry window from contract (BILL_EXPIRY_SECONDS)
export function useExpiryWindow() {
  return useReadContract({
    address: QUIKPAY_CONTRACT_ADDRESS,
    abi: QUIKPAY_ABI,
    functionName: 'BILL_EXPIRY_SECONDS',
  })
}

// Hook to compute bill status: expired, secondsRemaining, canPay
export function useBillComputedStatus(billId: string) {
  const billQuery = useBillDetails(billId)
  const expiryQuery = useExpiryWindow()

  const bill = billQuery.data as any
  const expirySec = expiryQuery.data as bigint | undefined

  if (!bill || !expirySec) {
    return {
      loading: billQuery.isLoading || expiryQuery.isLoading,
      expired: undefined as boolean | undefined,
      secondsRemaining: undefined as number | undefined,
      canPay: undefined as boolean | undefined,
    }
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const createdAt = Number(bill.createdAt ?? 0)
  const deadline = createdAt + Number(expirySec)
  const expired = !bill.paid && !bill.canceled && deadline <= nowSec
  const secondsRemaining = bill.paid || bill.canceled ? 0 : Math.max(0, deadline - nowSec)
  const canPay = !bill.paid && !bill.canceled && !expired

  return { loading: false, expired, secondsRemaining, canPay }
}

export function useQuikPayContract() {
  const { writeContract, data: hash, error, isPending } = useWriteContract()

  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({ hash })

  // Create a new bill
  const createBill = async (billId: string, token: Address, amount: string) => {
    const amountWei = token === '0x0000000000000000000000000000000000000000' 
      ? parseEther(amount) 
      : BigInt(amount)

    return writeContract({
      address: QUIKPAY_CONTRACT_ADDRESS,
      abi: QUIKPAY_ABI,
      functionName: 'createBill',
      args: [billId as `0x${string}`, token, amountWei],
    })
  }

  // Pay a bill
  const payBill = async (billId: string) => {
    return writeContract({
      address: QUIKPAY_CONTRACT_ADDRESS,
      abi: QUIKPAY_ABI,
      functionName: 'payBill',
      args: [billId as `0x${string}`],
    })
  }

  return {
    createBill,
    payBill,
    hash,
    error,
    isPending,
    isConfirming,
    isConfirmed,
  }
}

// Hook to read bill details
export function useBillDetails(billId: string) {
  return useReadContract({
    address: QUIKPAY_CONTRACT_ADDRESS,
    abi: QUIKPAY_ABI,
    functionName: 'getBill',
    args: [billId as `0x${string}`],
    query: {
      enabled: !!billId,
    },
  })
}

// Hook to check bill status
export function useBillStatus(billId: string) {
  return useReadContract({
    address: QUIKPAY_CONTRACT_ADDRESS,
    abi: QUIKPAY_ABI,
    functionName: 'billStatus',
    args: [billId as `0x${string}`],
    query: {
      enabled: !!billId,
    },
  })
}

// Hook to get user's bills
export function useUserBills(userAddress: Address) {
  return useReadContract({
    address: QUIKPAY_CONTRACT_ADDRESS,
    abi: QUIKPAY_ABI,
    functionName: 'getUserBills',
    args: [userAddress],
    query: {
      enabled: !!userAddress,
    },
  })
}

// Hook to generate bill ID
export function useGenerateBillId(userAddress: Address, nonce: bigint) {
  return useReadContract({
    address: QUIKPAY_CONTRACT_ADDRESS,
    abi: QUIKPAY_ABI,
    functionName: 'generateBillId',
    args: [userAddress, nonce],
    query: {
      enabled: !!userAddress && nonce !== undefined,
    },
  })
}

// Hook to get user nonce
export function useUserNonce(userAddress: Address) {
  return useReadContract({
    address: QUIKPAY_CONTRACT_ADDRESS,
    abi: QUIKPAY_ABI,
    functionName: 'getNonce',
    args: [userAddress],
    query: {
      enabled: !!userAddress,
    },
  })
}

// Hook to get contract stats
export function useContractStats() {
  const { data: totalBills } = useReadContract({
    address: QUIKPAY_CONTRACT_ADDRESS,
    abi: QUIKPAY_ABI,
    functionName: 'totalBills',
  })

  const { data: totalPaidBills } = useReadContract({
    address: QUIKPAY_CONTRACT_ADDRESS,
    abi: QUIKPAY_ABI,
    functionName: 'totalPaidBills',
  })

  return {
    totalBills: totalBills ? Number(totalBills) : 0,
    totalPaidBills: totalPaidBills ? Number(totalPaidBills) : 0,
    successRate: totalBills && totalPaidBills 
      ? (Number(totalPaidBills) / Number(totalBills)) * 100 
      : 0,
  }
}
