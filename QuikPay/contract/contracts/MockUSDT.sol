// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDT (ERC20Permit)
 * @dev Simple mintable ERC20 with EIP-2612 permit for testing gasless ERC20 payments.
 */
contract MockUSDT is ERC20Permit, Ownable {
    constructor() ERC20("Mock USDT", "mUSDT") ERC20Permit("Mock USDT") Ownable(msg.sender) {
        // Mint initial supply to deployer for convenience (1,000,000 mUSDT with 6 decimals)
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    function decimals() public pure override returns (uint8) {
        return 6; // mimic USDT
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
