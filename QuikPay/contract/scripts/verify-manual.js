const fs = require('fs');
const path = require('path');

async function main() {
  console.log("Manual Contract Verification for Lisk Sepolia (Blockscout)");
  const contractAddress = process.env.CONTRACT_ADDRESS || '<your_deployed_address_here>';
  console.log("Contract Address:", contractAddress);

  // Read the contract source code
  const contractPath = path.join(__dirname, '../contracts/QuikPay.sol');
  const sourceCode = fs.readFileSync(contractPath, 'utf8');

  console.log("Verification Details:");
  console.log("Contract Name: QuikPay");
  console.log("Compiler Version: 0.8.20");
  console.log("Optimization: Enabled (200 runs)");
  console.log("License: MIT");

  console.log("Source Code Preview:");
  console.log("=".repeat(50));
  console.log(sourceCode.substring(0, 500) + "...");
  console.log("=".repeat(50));

  console.log("\n Manual Verification Instructions:");
  console.log("1. Go to: https://sepolia-blockscout.lisk.com/address/" + contractAddress);
  console.log("2. Click 'Verify Contract' button");
  console.log("3. Select 'Solidity (Single file)'");
  console.log("4. Enter the following details:");
  console.log("   - Contract Name: QuikPay");
  console.log("   - Compiler Version: v0.8.20+commit.a1b79de6");
  console.log("   - Optimization: Yes (200 runs)");
  console.log("   - License Type: MIT");
  console.log("5. Copy and paste the entire source code from contracts/QuikPay.sol");
  console.log("6. Click 'Verify and Publish'");

  console.log("\n Full source code file location:");
  console.log(contractPath);

  console.log("\n After manual verification, the contract source code will be visible on the explorer!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(" Error:", error);
    process.exit(1);
  });
