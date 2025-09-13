// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC (ERC20Permit)
 * @dev Simple mintable ERC20 with EIP-2612 permit for testing gasless ERC20 payments.
 */
contract MockUSDC is ERC20Permit, Ownable {
    constructor() ERC20("Mock USDC", "mUSDC") ERC20Permit("Mock USDC") Ownable(msg.sender) {
        // Mint initial supply to deployer for convenience (1,000,000 mUSDC with 6 decimals)
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    function decimals() public pure override returns (uint8) {
        return 6; // mimic USDC
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
