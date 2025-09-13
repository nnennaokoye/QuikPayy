const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying QuikPay locally (Hardhat network)...\n");
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", await deployer.getAddress());

  const QuikPay = await ethers.getContractFactory("QuikPay");
  const quikPay = await QuikPay.deploy();
  await quikPay.waitForDeployment();
  const addr = await quikPay.getAddress();
  console.log("QuikPay deployed at:", addr);

  // Create a test bill
  const token = "0x0000000000000000000000000000000000000001"; // dummy nonzero token address
  const amount = ethers.parseUnits("1", 18);
  const billId = ethers.keccak256(ethers.toUtf8Bytes("test-bill-1"));

  console.log("\nCreating bill...");
  await (await quikPay.createBill(billId, token, amount)).wait();

  const billBefore = await quikPay.getBill(billId);
  console.log("Bill createdAt:", billBefore.createdAt.toString());

  // Initially, should not be expired
  let hasExpired = await quikPay.hasExpiredBills(deployer.address);
  console.log("Has expired bills (before time travel):", hasExpired);

  // Time travel 73 hours
  const seventyThreeHours = 73 * 60 * 60;
  await ethers.provider.send('evm_increaseTime', [seventyThreeHours]);
  await ethers.provider.send('evm_mine');

  // Now should report expired
  hasExpired = await quikPay.hasExpiredBills(deployer.address);
  console.log("Has expired bills (after time travel):", hasExpired);

  console.log("\nExpiring up to 1 bill...");
  const tx = await quikPay.expireOldBills(deployer.address, 1);
  const receipt = await tx.wait();
  console.log("Expired tx hash:", receipt.hash);

  // Confirm bill is canceled
  const billAfter = await quikPay.getBill(billId);
  console.log("Bill canceled:", billAfter.canceled);

  console.log("\nLocal expiration test completed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
