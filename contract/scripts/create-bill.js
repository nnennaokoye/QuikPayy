const { ethers } = require("hardhat");

function usage() {
  console.log(
    "Usage:\n  npx hardhat run scripts/create-bill.js --network <network> -- <contract> <billIdText> <tokenAddress> <amountWei>\n\nExamples:\n  npx hardhat run scripts/create-bill.js --network liskSepolia -- 0xContract 'invoice-123' 0xToken 1000000000000000000\n"
  );
}

async function main() {
  const sepIndex = process.argv.indexOf('--');
  const args = sepIndex >= 0 ? process.argv.slice(sepIndex + 1) : process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (args.length < 4) {
    usage();
    process.exit(1);
  }

  const [contractAddr, billIdText, tokenAddress, amountWeiStr] = args;
  if (!ethers.isAddress(contractAddr)) throw new Error('Invalid contract address');
  if (!ethers.isAddress(tokenAddress)) throw new Error('Invalid token address');
  const amount = BigInt(amountWeiStr);

  const billId = ethers.keccak256(ethers.toUtf8Bytes(billIdText));
  const quikpay = await ethers.getContractAt('QuikPay', contractAddr);
  console.log('Creating bill...');
  const tx = await quikpay.createBill(billId, tokenAddress, amount);
  console.log('Tx hash:', tx.hash);
  const receipt = await tx.wait();
  console.log('Mined in block', receipt.blockNumber);
  console.log('Bill ID:', billId);
}

main().catch((e) => { console.error(e); process.exit(1); });
