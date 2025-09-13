const { ethers } = require("hardhat");

function getArg(name, fallback) {
  const idx = process.argv.findIndex(a => a === `--${name}`)
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1]
  const env = process.env[name.toUpperCase()]
  if (env) return env
  return fallback
}

async function main() {
  const [signer] = await ethers.getSigners();
  const deployer = await signer.getAddress();
  const net = await ethers.provider.getNetwork();

  console.log(" Network:", net.name, `(${net.chainId})`)
  console.log(" Sender:", deployer)

  const tokenAddress = getArg('token', getArg('token_address', null))
  if (!tokenAddress) throw new Error('Missing --token <address>')

  const toCsv = getArg('to', '0x167142915AD0fAADD84d9741eC253B82aB8625cd,0x4d0218d59ca90f619000852BD9D8fbb019C05C07')
  const recipients = toCsv.split(',').map(s => s.trim()).filter(Boolean)

  const amountStr = getArg('amount', '1.5') // WETH 18dp by default
  const amount = ethers.parseUnits(amountStr, 18)

  console.log(" Token:", tokenAddress)
  console.log(" Recipients:", recipients)
  console.log(" Amount each (18dp):", amount.toString())

  const token = await ethers.getContractAt('MockWETH', tokenAddress)
  
  // Get the current nonce and manage it manually
  let nonce = await ethers.provider.getTransactionCount(deployer, 'pending');
  
  for (const to of recipients) {
    console.log(` Minting to ${to} ...`)
    try {
      const tx = await token.mint(to, amount, { nonce: nonce })
      console.log('  tx:', tx.hash)
      console.log('  nonce used:', nonce)
      await tx.wait()
      const bal = await token.balanceOf(to)
      console.log('  balance:', bal.toString())
      nonce++ // Increment nonce for next transaction
    } catch (error) {
      console.error(`  Error minting to ${to}:`, error.message)
      // If nonce error, try to get fresh nonce
      if (error.message.includes('nonce')) {
        console.log('  Refreshing nonce...')
        nonce = await ethers.provider.getTransactionCount(deployer, 'pending');
        console.log('  New nonce:', nonce)
        // Retry the transaction
        const tx = await token.mint(to, amount, { nonce: nonce })
        console.log('  tx (retry):', tx.hash)
        await tx.wait()
        const bal = await token.balanceOf(to)
        console.log('  balance:', bal.toString())
        nonce++
      } else {
        throw error
      }
    }
    
    // Small delay to avoid overwhelming the network
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  console.log(' Minting complete')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });