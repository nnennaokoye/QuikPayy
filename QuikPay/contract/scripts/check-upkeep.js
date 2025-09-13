const { ethers } = require("hardhat");

function usage() {
  console.log(
    "Usage:\n  npx hardhat run scripts/check-upkeep.js --network <network> -- <contract> <receiver> <maxToExpire>\n  or\n  npx hardhat run scripts/check-upkeep.js --network <network> -- <contract> <encodedHex>\n\nNotes:\n- Use the '--' separator to stop Hardhat from parsing script args."
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
  const [contractAddr, a2, a3] = args;
  const quikpay = await ethers.getContractAt("QuikPay", contractAddr);

  let checkData;
  if (a2 && a3) {
    if (!ethers.isAddress(a2)) throw new Error("receiver must be a valid address");
    const maxToExpire = BigInt(a3);
    const coder = ethers.AbiCoder.defaultAbiCoder();
    checkData = coder.encode(["address", "uint256"], [a2, maxToExpire]);
  } else if (a2) {
    // encoded hex path
    checkData = a2;
  } else {
    usage();
    process.exit(1);
  }

  const [needed, performData] = await quikpay.checkUpkeep.staticCall(checkData);
  console.log("upkeepNeeded:", needed);
  console.log("performData:", performData);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
