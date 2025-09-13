const { ethers } = require("hardhat");

function usage() {
  console.log(
    "Usage:\n  npx hardhat run scripts/expire-bills.js --network <network> -- <contract> <receiver> <maxToExpire>\n\nNotes:\n- Use the '--' separator to stop Hardhat from parsing script args.\n- This script manually expires old bills for a given receiver."
  );
}

async function main() {
  // Prefer args after '--' if provided (Hardhat safe). Fallback to naive parsing.
  const sepIndex = process.argv.indexOf('--');
  const args = sepIndex >= 0
    ? process.argv.slice(sepIndex + 1)
    : process.argv.slice(2).filter(a => !a.startsWith("--"));

  if (args.length < 3) {
    usage();
    process.exit(1);
  }

  const [contractAddr, receiver, maxToExpireStr] = args;
  
  if (!ethers.isAddress(contractAddr)) {
    throw new Error("Contract address must be a valid address");
  }
  
  if (!ethers.isAddress(receiver)) {
    throw new Error("Receiver must be a valid address");
  }

  const maxToExpire = BigInt(maxToExpireStr);
  if (maxToExpire <= 0) {
    throw new Error("maxToExpire must be greater than 0");
  }

  const quikpay = await ethers.getContractAt("QuikPay", contractAddr);

  // Check if there are expired bills first
  const hasExpired = await quikpay.hasExpiredBills(receiver);
  console.log(`Checking for expired bills for receiver: ${receiver}`);
  console.log(`Has expired bills: ${hasExpired}`);

  if (!hasExpired) {
    console.log("No expired bills found for this receiver.");
    return;
  }

  // Execute the expiration
  console.log(`Expiring up to ${maxToExpire} bills for receiver: ${receiver}`);
  const tx = await quikpay.expireOldBills(receiver, maxToExpire);
  console.log(`Transaction hash: ${tx.hash}`);
  
  const receipt = await tx.wait();
  console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
  console.log(`Gas used: ${receipt.gasUsed.toString()}`);

  // Check for BillExpired events
  const expiredEvents = receipt.logs.filter(log => {
    try {
      const parsed = quikpay.interface.parseLog(log);
      return parsed.name === 'BillExpired';
    } catch {
      return false;
    }
  });

  console.log(`\nExpired ${expiredEvents.length} bills:`);
  expiredEvents.forEach((log, index) => {
    const parsed = quikpay.interface.parseLog(log);
    console.log(`  ${index + 1}. Bill ID: ${parsed.args.billId}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
