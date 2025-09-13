const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log(" Deploying QuikPay contract...");
  
  // Get the deployer account
  const signers = await ethers.getSigners();
  if (!signers || signers.length === 0) {
    throw new Error(
      "No signer available. Ensure PRIVATE_KEY is set in contract/.env (with or without 0x). " +
      "Also confirm networks.liskSepolia.accounts is configured in hardhat.config.js."
    );
  }
  const deployer = signers[0];
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);
  
  console.log(" Deployer address:", deployerAddress);
  console.log(" Deployer balance:", ethers.formatEther(balance), "ETH");
  
  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log(" Network:", network.name);
  console.log(" Chain ID:", network.chainId.toString());
  try {
    const providerUrl = hre.network.config.url;
    if (providerUrl) console.log(" RPC URL:", providerUrl);
  } catch {}
  
  // Deploy the contract
  console.log("\n Deploying QuikPay contract...");
  const QuikPay = await ethers.getContractFactory("QuikPay");
  
  // Get current fee data (EIP-1559)
  const feeData = await ethers.provider.getFeeData();
  console.log(" Current fee data:");
  console.log("  Base fee:", feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") + " gwei" : "N/A");
  console.log("  Max fee per gas:", feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, "gwei") + " gwei" : "N/A");
  console.log("  Max priority fee:", feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, "gwei") + " gwei" : "N/A");
  
  // Get gas estimate and add 5% buffer
  const deploymentData = QuikPay.interface.encodeDeploy([]);
  const gasEstimate = await ethers.provider.estimateGas({
    data: QuikPay.bytecode + deploymentData.slice(2)
  });
  const gasLimit = (gasEstimate * 105n) / 100n; // Add 5% buffer
  
  console.log("⛽ Estimated gas:", gasEstimate.toString());
  console.log("⛽ Gas limit (with 5% buffer):", gasLimit.toString());
  
  // Calculate total cost
  const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || 0n;
  const totalCost = gasLimit * maxFeePerGas;
  console.log("💸 Estimated total cost:", ethers.formatEther(totalCost), "ETH");
  
  // Deploy with EIP-1559 transaction
  const deployOptions = {
    gasLimit: gasLimit,
  };
  
  // Add EIP-1559 fields if available
  if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
    deployOptions.maxFeePerGas = (feeData.maxFeePerGas * 110n) / 100n; // Add 10% buffer
    deployOptions.maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * 110n) / 100n;
    console.log("🔥 Using EIP-1559 transaction");
  } else if (feeData.gasPrice) {
    deployOptions.gasPrice = (feeData.gasPrice * 110n) / 100n; // Add 10% buffer
    console.log("⚡ Using legacy transaction");
  }
  
  const quikPay = await QuikPay.deploy(deployOptions);
  
  // Wait for deployment
  await quikPay.waitForDeployment();
  const contractAddress = await quikPay.getAddress();
  
  console.log("✅ QuikPay deployed successfully!");
  console.log("📍 Contract address:", contractAddress);
  console.log("🔍 Block explorer:", getExplorerUrl(network.chainId, contractAddress));

  // Prepare deployment info
  const deploymentInfo = {
    contract: "QuikPay",
    address: contractAddress,
    deployer: deployerAddress,
    chainId: network.chainId.toString(),
    timestamp: new Date().toISOString(),
    txHash: quikPay.deploymentTransaction().hash,
  };

  // Persist deployment info
  try {
    const fs = require('fs');
    const path = require('path');
    const outDir = path.resolve(__dirname, '..', 'deployments');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${network.name || 'liskSepolia'}-latest.json`);
    fs.writeFileSync(outPath, JSON.stringify(deploymentInfo, null, 2));
    console.log("📝 Saved deployment info to:", outPath);
  } catch (e) {
    console.log("⚠️  Failed to write deployment info:", e?.message || e);
  }

  console.log("\nNext:");
  console.log(`  npx hardhat verify --network ${network.name || 'liskSepolia'} ${contractAddress}`);
  
  console.log("\n📋 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  // Verify contract (optional)
  if (network.chainId === 4202n || network.chainId === 1135n) {
    console.log("\n⏳ Waiting 30 seconds before verification...");
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log("✅ Contract verified successfully!");
    } catch (error) {
      console.log("⚠️  Verification failed:", error.message);
    }
  }
}

function getExplorerUrl(chainId, address) {
  switch (chainId.toString()) {
    case "4202":
      return `https://sepolia-blockscout.lisk.com/address/${address}`;
    case "1135":
      return `https://blockscout.lisk.com/address/${address}`;
    default:
      return `Chain ID ${chainId} - Explorer not configured`;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }); 