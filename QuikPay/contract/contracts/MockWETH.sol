// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockWETH (ERC20Permit)
 * @dev Mintable ERC20 with EIP-2612 permit to simulate WETH for gasless ERC20 payments.
 */
contract MockWETH is ERC20Permit, Ownable {
    constructor() ERC20("Mock WETH", "mWETH") ERC20Permit("Mock WETH") Ownable(msg.sender) {
        // Mint initial supply to deployer for convenience (1,000,000 mWETH with 18 decimals)
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
