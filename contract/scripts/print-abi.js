const hre = require("hardhat");

async function main() {
  const artifact = await hre.artifacts.readArtifact("QuikPay");
  
  console.log(JSON.stringify(artifact.abi));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
