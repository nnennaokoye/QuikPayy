require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { PRIVATE_KEY } = process.env;
// Normalize private key to ensure it is 0x-prefixed if provided without
const PK = PRIVATE_KEY
  ? (PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`)
  : undefined;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  // Disable Sourcify messages during verification (optional, reduces noise)
  sourcify: {
    enabled: false,
  },
  networks: {
    liskSepolia: {
      url: "https://rpc.sepolia-api.lisk.com",
      chainId: 4202,
      accounts: PK ? [PK] : [],
      gasPrice: "auto",
      gas: "auto",
    },
    lisk: {
      url: "https://rpc.api.lisk.com",
      chainId: 1135,
      accounts: PK ? [PK] : [],
      
      type: 2,
      maxFeePerGas: "auto",
      maxPriorityFeePerGas: "auto",
      gas: "auto",
    },
  },
  etherscan: {
    // Provide per-network keys (Blockscout usually ignores the key, but hardhat-verify expects non-empty mapping)
    apiKey: {
      liskSepolia: process.env.ETHERSCAN_API_KEY || "blockscout",
      lisk: process.env.ETHERSCAN_API_KEY || "blockscout",
    },
    customChains: [
      {
        network: "liskSepolia",
        chainId: 4202,
        urls: {
          apiURL: "https://sepolia-blockscout.lisk.com/api",
          browserURL: "https://sepolia-blockscout.lisk.com",
        },
      },
      {
        network: "lisk",
        chainId: 1135,
        urls: {
          apiURL: "https://blockscout.lisk.com/api",
          browserURL: "https://blockscout.lisk.com",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
}; 