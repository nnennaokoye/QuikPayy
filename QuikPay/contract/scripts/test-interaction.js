const { ethers } = require("hardhat");

async function main() {
  const contractAddr = "0x1be4B9D2322Af38e9f7f1496eBa46b7Cd31d3b51";
  const [deployer] = await ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  
  console.log("Testing QuikPay interaction on Lisk Sepolia");
  console.log("Contract:", contractAddr);
  console.log("Deployer:", deployerAddr);
  
  const quikpay = await ethers.getContractAt('QuikPay', contractAddr);
  
  // Test 1: Create a bill
  console.log("\n1. Creating a test bill...");
  const billIdText = "test-invoice-" + Date.now();
  const billId = ethers.keccak256(ethers.toUtf8Bytes(billIdText));
  const tokenAddress = "0x0000000000000000000000000000000000000001"; // dummy token
  const amount = ethers.parseEther("1.0");
  
  try {
    const tx = await quikpay.createBill(billId, tokenAddress, amount);
    console.log("Tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Bill created in block", receipt.blockNumber);
    console.log("Bill ID:", billId);
  } catch (error) {
    console.log("❌ Create bill failed:", error.message);
  }
  
  // Test 2: Check if user has expired bills
  console.log("\n2. Checking for expired bills...");
  try {
    const hasExpired = await quikpay.hasExpiredBills(deployerAddr);
    console.log("Has expired bills:", hasExpired);
  } catch (error) {
    console.log("❌ Check expired failed:", error.message);
  }
  
  // Test 3: Try to expire bills (will be no-op since bill is fresh)
  console.log("\n3. Attempting to expire bills...");
  try {
    const tx = await quikpay.expireOldBills(deployerAddr, 5);
    console.log("Expire tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Expire transaction completed in block", receipt.blockNumber);
  } catch (error) {
    console.log("❌ Expire bills failed:", error.message);
  }
  
  // Test 4: Get bill details
  console.log("\n4. Getting bill details...");
  try {
    const bill = await quikpay.getBill(billId);
    console.log("Bill details:");
    console.log("  Receiver:", bill.receiver);
    console.log("  Token:", bill.token);
    console.log("  Amount:", ethers.formatEther(bill.amount), "ETH");
    console.log("  Paid:", bill.paid);
    console.log("  Canceled:", bill.canceled);
    console.log("  Created at:", new Date(Number(bill.createdAt) * 1000).toISOString());
  } catch (error) {
    console.log("❌ Get bill failed:", error.message);
  }
  
  console.log("\n✅ Interaction test completed!");
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
