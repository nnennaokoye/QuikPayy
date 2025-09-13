import { QUIKPAY_CONTRACT_ADDRESS, QUIKPAY_ABI } from './contract';
import { readContract, writeContract } from '@wagmi/core';
import { wagmiConfig } from './appkit';

// Bill expiration constants (matching contract)
export const BILL_EXPIRY_SECONDS = 72 * 60 * 60; // 72 hours

export interface Bill {
  receiver: string;
  token: string;
  amount: bigint;
  paid: boolean;
  canceled: boolean;
  createdAt: bigint;
  paidAt: bigint;
  payer: string;
}

/**
 * Check if a bill is expired based on creation time
 */
export function isBillExpired(bill: Bill): boolean {
  if (bill.paid || bill.canceled) return false;
  
  const currentTime = Math.floor(Date.now() / 1000);
  const expiryTime = Number(bill.createdAt) + BILL_EXPIRY_SECONDS;
  
  return currentTime >= expiryTime;
}

/**
 * Get time remaining until bill expires (in seconds)
 */
export function getBillTimeRemaining(bill: Bill): number {
  if (bill.paid || bill.canceled) return 0;
  
  const currentTime = Math.floor(Date.now() / 1000);
  const expiryTime = Number(bill.createdAt) + BILL_EXPIRY_SECONDS;
  
  return Math.max(0, expiryTime - currentTime);
}

/**
 * Format time remaining as human readable string
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else if (minutes > 0) {
    return `${minutes}m remaining`;
  } else {
    return `${seconds}s remaining`;
  }
}

/**
 * Check if a receiver has expired bills on-chain
 */
export async function hasExpiredBills(receiver: string): Promise<boolean> {
  try {
    const result = await readContract(wagmiConfig, {
      address: QUIKPAY_CONTRACT_ADDRESS as `0x${string}`,
      abi: QUIKPAY_ABI,
      functionName: 'hasExpiredBills',
      args: [receiver as `0x${string}`],
    });
    return result as boolean;
  } catch (error) {
    console.error('Error checking expired bills:', error);
    // Fallback to frontend evaluation if the node/ABI has issues
    try {
      const billIds = await getUserBills(receiver);
      for (const billId of billIds) {
        const bill = await getBill(billId);
        if (bill && isBillExpired(bill)) return true;
      }
    } catch {}
    return false;
  }
}

/**
 * Get all bills for a user
 */
export async function getUserBills(userAddress: string): Promise<string[]> {
  try {
    const result = await readContract(wagmiConfig, {
      address: QUIKPAY_CONTRACT_ADDRESS as `0x${string}`,
      abi: QUIKPAY_ABI,
      functionName: 'getUserBills',
      args: [userAddress as `0x${string}`],
    });
    
    return result as string[];
  } catch (error) {
    console.error('Error getting user bills:', error);
    return [];
  }
}

/**
 * Get bill details
 */
export async function getBill(billId: string): Promise<Bill | null> {
  try {
    const result = await readContract(wagmiConfig, {
      address: QUIKPAY_CONTRACT_ADDRESS as `0x${string}`,
      abi: QUIKPAY_ABI,
      functionName: 'getBill',
      args: [billId as `0x${string}`],
    });
    // Normalize tuple/object return into our Bill shape
    const r = result as any;
    const bill: Bill = {
      receiver: (r?.receiver ?? r?.[0]) as `0x${string}`,
      token: (r?.token ?? r?.[1]) as `0x${string}`,
      amount: (r?.amount ?? r?.[2]) as bigint,
      paid: (r?.paid ?? r?.[3]) as boolean,
      canceled: (r?.canceled ?? r?.[4]) as boolean,
      createdAt: (r?.createdAt ?? r?.[5]) as bigint,
      paidAt: (r?.paidAt ?? r?.[6]) as bigint,
      payer: (r?.payer ?? r?.[7]) as `0x${string}`,
    };
    return bill;
  } catch (error) {
    console.error('Error getting bill:', error);
    return null;
  }
}

/**
 * Expire old bills for a receiver (requires transaction)
 */
export async function expireOldBills(receiver: string, maxToExpire: number = 10) {
  try {
    const result = await writeContract(wagmiConfig, {
      address: QUIKPAY_CONTRACT_ADDRESS as `0x${string}`,
      abi: QUIKPAY_ABI,
      functionName: 'expireOldBills',
      args: [receiver as `0x${string}`, BigInt(maxToExpire)],
    });
    
    return result;
  } catch (error) {
    console.error('Error expiring bills:', error);
    throw error;
  }
}

/**
 * Get expired bills for a user (frontend filtering)
 */
export async function getExpiredBills(userAddress: string): Promise<{ billId: string; bill: Bill }[]> {
  try {
    const billIds = await getUserBills(userAddress);
    const expiredBills: { billId: string; bill: Bill }[] = [];
    
    for (const billId of billIds) {
      const bill = await getBill(billId);
      if (bill && isBillExpired(bill)) {
        expiredBills.push({ billId, bill });
      }
    }
    
    return expiredBills;
  } catch (error) {
    console.error('Error getting expired bills:', error);
    return [];
  }
}

/**
 * Get active (non-expired, unpaid) bills for a user
 */
export async function getActiveBills(userAddress: string): Promise<{ billId: string; bill: Bill; timeRemaining: number }[]> {
  try {
    const billIds = await getUserBills(userAddress);
    const activeBills: { billId: string; bill: Bill; timeRemaining: number }[] = [];
    
    for (const billId of billIds) {
      const bill = await getBill(billId);
      if (bill && !bill.paid && !bill.canceled && !isBillExpired(bill)) {
        const timeRemaining = getBillTimeRemaining(bill);
        activeBills.push({ billId, bill, timeRemaining });
      }
    }
    
    // Sort by time remaining (closest to expiry first)
    return activeBills.sort((a, b) => a.timeRemaining - b.timeRemaining);
  } catch (error) {
    console.error('Error getting active bills:', error);
    return [];
  }
}
