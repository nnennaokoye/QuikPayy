const { ethers } = require("hardhat");

async function main() {
  console.log(" Deploying UsdcFaucet...");

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);

  console.log(" Deployer:", deployerAddress);
  console.log(" Balance:", ethers.formatEther(balance), "ETH");

  const network = await ethers.provider.getNetwork();
  console.log(" Network:", network.name, "(" + network.chainId + ")");

  // Read MockUSDC address from env or fallback to known Lisk Sepolia address
  const tokenAddress = process.env.MOCK_USDC_ADDRESS || "0xC4Bb350f7a4d17cc9D5557c4364F5c676Bd4Fa0D";
  if (!ethers.isAddress(tokenAddress)) {
    throw new Error("Invalid or missing MOCK_USDC_ADDRESS – set it in contract/.env");
  }

  // 50 mUSDC with 6 decimals
  const claimAmount = ethers.parseUnits("50", 6);
  // 24 hours cooldown
  const claimCooldown = 24 * 60 * 60; // seconds

  console.log(" Token (MockUSDC):", tokenAddress);
  console.log(" Claim amount:", claimAmount.toString(), "(raw)");
  console.log(" Cooldown:", claimCooldown, "seconds (~24h)");

  const Faucet = await ethers.getContractFactory("UsdcFaucet");
  const faucet = await Faucet.deploy(tokenAddress, claimAmount, claimCooldown);
  await faucet.waitForDeployment();

  const address = await faucet.getAddress();
  console.log(" UsdcFaucet deployed at:", address);
  console.log(" Explorer:", getExplorerUrl(network.chainId, address));

  console.log("\nNext steps:");
  console.log(" 1) Transfer MockUSDC ownership to the faucet so it can mint:");
  console.log("    - Call MockUSDC.transferOwnership(" + address + ") from the current owner.");
  console.log(" 2) Update your frontend to call faucet.claim() at this address.");
}

function getExplorerUrl(chainId, address) {
  switch (chainId.toString()) {
    case "4202":
      return `https://sepolia-blockscout.lisk.com/address/${address}`;
    case "1135":
      return `https://blockscout.lisk.com/address/${address}`;
    default:
      return `Chain ID ${chainId}`;
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
