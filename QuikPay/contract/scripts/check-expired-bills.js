const { ethers } = require("hardhat");

function usage() {
  console.log(
    "Usage:\n  npx hardhat run scripts/check-expired-bills.js --network <network> -- <contract> <receiver>\n\nNotes:\n- Use the '--' separator to stop Hardhat from parsing script args.\n- This script checks if a receiver has any expired bills that can be cleaned up."
  );
}

async function main() {
  // Prefer args after '--' if provided (Hardhat safe). Fallback to naive parsing.
  const sepIndex = process.argv.indexOf('--');
  const args = sepIndex >= 0
    ? process.argv.slice(sepIndex + 1)
    : process.argv.slice(2).filter(a => !a.startsWith("--"));

  if (args.length < 2) {
    usage();
    process.exit(1);
  }

  const [contractAddr, receiver] = args;
  
  if (!ethers.isAddress(contractAddr)) {
    throw new Error("Contract address must be a valid address");
  }
  
  if (!ethers.isAddress(receiver)) {
    throw new Error("Receiver must be a valid address");
  }

  const quikpay = await ethers.getContractAt("QuikPay", contractAddr);

  // Check if there are expired bills
  const hasExpired = await quikpay.hasExpiredBills(receiver);
  console.log(`Receiver: ${receiver}`);
  console.log(`Has expired bills: ${hasExpired}`);

  if (hasExpired) {
    console.log("\n💡 You can expire these bills by running:");
    console.log(`npx hardhat run scripts/expire-bills.js --network <network> -- ${contractAddr} ${receiver} <maxToExpire>`);
  } else {
    console.log("\n✅ No expired bills found for this receiver.");
  }

  // Get all bills for this receiver to show details
  const userBills = await quikpay.getUserBills(receiver);
  console.log(`\nTotal bills for this receiver: ${userBills.length}`);

  if (userBills.length > 0) {
    console.log("\nBill details:");
    const currentTime = Math.floor(Date.now() / 1000);
    const BILL_EXPIRY_SECONDS = 72 * 60 * 60; // 72 hours

    for (let i = 0; i < Math.min(userBills.length, 10); i++) { // Show max 10 bills
      const bill = await quikpay.getBill(userBills[i]);
      const isExpired = !bill.paid && !bill.canceled && 
                       (Number(bill.createdAt) + BILL_EXPIRY_SECONDS <= currentTime);
      
      console.log(`  ${i + 1}. Bill ID: ${userBills[i]}`);
      console.log(`     Token: ${bill.token}`);
      console.log(`     Amount: ${ethers.formatUnits(bill.amount, 18)}`);
      console.log(`     Paid: ${bill.paid}`);
      console.log(`     Canceled: ${bill.canceled}`);
      console.log(`     Created: ${new Date(Number(bill.createdAt) * 1000).toISOString()}`);
      console.log(`     Expired: ${isExpired ? '🔴 YES' : '🟢 NO'}`);
      console.log('');
    }

    if (userBills.length > 10) {
      console.log(`... and ${userBills.length - 10} more bills`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
