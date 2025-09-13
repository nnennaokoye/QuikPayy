const { ethers } = require("hardhat");

async function main() {
  const contractAddr = "0x1be4B9D2322Af38e9f7f1496eBa46b7Cd31d3b51";
  const usdcAddr = "0xC4Bb350f7a4d17cc9D5557c4364F5c676Bd4Fa0D";
  const usdtAddr = "0x8dA801bEb2BCAD9AA44Dc2B029fE680796aa3faf";
  const wethAddr = "0x80e81201b63d6958c6f1977B0e1d52064B260750";
  
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  
  console.log("Testing QuikPay with real tokens on Lisk Sepolia");
  console.log("QuikPay:", contractAddr);
  console.log("Deployer:", deployerAddr);
  
  const quikpay = await ethers.getContractAt('QuikPay', contractAddr);
  const usdc = await ethers.getContractAt('MockUSDC', usdcAddr);
  const usdt = await ethers.getContractAt('MockUSDT', usdtAddr);
  const weth = await ethers.getContractAt('MockWETH', wethAddr);
  
  // Check token balances
  console.log("\n Token Balances:");
  const usdcBalance = await usdc.balanceOf(deployerAddr);
  const usdtBalance = await usdt.balanceOf(deployerAddr);
  const wethBalance = await weth.balanceOf(deployerAddr);
  
  console.log("USDC:", ethers.formatUnits(usdcBalance, 6), "mUSDC");
  console.log("USDT:", ethers.formatUnits(usdtBalance, 6), "mUSDT");
  console.log("WETH:", ethers.formatEther(wethBalance), "mWETH");
  
  // Test 1: Create a bill with USDC
  console.log("\n1. Creating USDC bill (100 mUSDC)...");
  const billIdText = "usdc-bill-" + Date.now();
  const billId = ethers.keccak256(ethers.toUtf8Bytes(billIdText));
  const amount = ethers.parseUnits("100", 6); // 100 USDC (6 decimals)
  
  try {
    const tx = await quikpay.createBill(billId, usdcAddr, amount);
    console.log("Tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("USDC bill created in block", receipt.blockNumber);
    console.log("Bill ID:", billId);
  } catch (error) {
    console.log("Create USDC bill failed:", error.message);
  }
  
  // Test 2: Create a bill with WETH
  console.log("\n2. Creating WETH bill (0.5 mWETH)...");
  const wethBillIdText = "weth-bill-" + Date.now();
  const wethBillId = ethers.keccak256(ethers.toUtf8Bytes(wethBillIdText));
  const wethAmount = ethers.parseEther("0.5"); // 0.5 WETH
  
  try {
    const tx = await quikpay.createBill(wethBillId, wethAddr, wethAmount);
    console.log("Tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("WETH bill created in block", receipt.blockNumber);
    console.log("Bill ID:", wethBillId);
  } catch (error) {
    console.log("Create WETH bill failed:", error.message);
  }
  
  // Test 3: Get bill details
  console.log("\n3. Getting USDC bill details...");
  try {
    const bill = await quikpay.getBill(billId);
    console.log("USDC Bill details:");
    console.log("  Receiver:", bill.receiver);
    console.log("  Token:", bill.token);
    console.log("  Amount:", ethers.formatUnits(bill.amount, 6), "mUSDC");
    console.log("  Paid:", bill.paid);
    console.log("  Canceled:", bill.canceled);
    console.log("  Created at:", new Date(Number(bill.createdAt) * 1000).toISOString());
  } catch (error) {
    console.log("Get USDC bill failed:", error.message);
  }
  
  // Test 4: Check for expired bills
  console.log("\n4. Checking for expired bills...");
  try {
    const hasExpired = await quikpay.hasExpiredBills(deployerAddr);
    console.log("Has expired bills:", hasExpired);
  } catch (error) {
    console.log("Check expired failed:", error.message);
  }
  
  // Test 5: Get user bills
  console.log("\n5. Getting user bills...");
  try {
    const billIds = await quikpay.getUserBills(deployerAddr);
    console.log("User has", billIds.length, "bills");
    for (let i = 0; i < Math.min(billIds.length, 3); i++) {
      console.log(`  Bill ${i + 1}:`, billIds[i]);
    }
  } catch (error) {
    console.log("Get user bills failed:", error.message);
  }
  
  console.log("Token testing completed!");
  console.log("Summary:");
  console.log("- QuikPay contract:", contractAddr);
  console.log("- MockUSDC:", usdcAddr);
  console.log("- MockUSDT:", usdtAddr);
  console.log("- MockWETH:", wethAddr);
  console.log("- Frontend token addresses updated");
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
