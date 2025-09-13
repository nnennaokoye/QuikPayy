const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function main() {
  const artifact = await hre.artifacts.readArtifact('QuikPay');
  const outPath = path.resolve(__dirname, '..', '..', 'frontend', 'lib', 'abi', 'quikpay.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(artifact.abi, null, 2));
  console.log('ABI written to:', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
