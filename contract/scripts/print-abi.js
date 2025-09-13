const hre = require("hardhat");

async function main() {
  const artifact = await hre.artifacts.readArtifact("QuikPay");
  // Print just the ABI JSON, compact form
  console.log(JSON.stringify(artifact.abi));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
