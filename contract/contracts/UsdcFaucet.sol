// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title UsdcFaucet
 * @dev Simple faucet for MockUSDC with a 24-hour cooldown per address.
 *      The faucet calls MockUSDC.mint() so it must be set as the token owner
 *      (transfer ownership from the deployer to this faucet after deployment).
 */
contract UsdcFaucet is Ownable {
    IERC20 public immutable token;

    // Amount dispensed per claim (in token's smallest units, e.g. 50e6 for 50 mUSDC with 6 decimals)
    uint256 public claimAmount;

    // Cooldown period between claims from the same address (in seconds)
    uint256 public claimCooldown;

    // Last claim timestamp per address
    mapping(address => uint256) public lastClaimAt;

    event Claimed(address indexed user, uint256 amount, uint256 timestamp);
    event ClaimAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event ClaimCooldownUpdated(uint256 oldCooldown, uint256 newCooldown);

    constructor(IERC20 _token, uint256 _claimAmount, uint256 _claimCooldown) Ownable(msg.sender) {
        require(address(_token) != address(0), "Token is zero address");
        require(_claimAmount > 0, "Claim amount = 0");
        require(_claimCooldown > 0, "Cooldown = 0");

        token = _token;
        claimAmount = _claimAmount;
        claimCooldown = _claimCooldown;
    }

    /**
     * @dev Claim faucet tokens. Can be called by any address, but limited
     *      by claimCooldown between successful claims.
     */
     
    function claim() external {
        uint256 last = lastClaimAt[msg.sender];
        uint256 nowTs = block.timestamp;

        // Enforce cooldown
        require(last == 0 || nowTs - last >= claimCooldown, "Wait before next claim");

        lastClaimAt[msg.sender] = nowTs;

        // We assume token is MockUSDC with a mint() function and this contract is the owner.
        // Use a low-level call to avoid tight ABI coupling; revert on failure.
        (bool ok, bytes memory data) = address(token).call(
            abi.encodeWithSignature("mint(address,uint256)", msg.sender, claimAmount)
        );
        require(ok, "Mint failed");
        // If token reverts with a reason, it will bubble up automatically.
        // If it returns a boolean, we can optionally check it here.
        if (data.length > 0) {
            // Some tokens return a bool; ensure it's true if present.
            require(abi.decode(data, (bool)), "Mint returned false");
        }

        emit Claimed(msg.sender, claimAmount, nowTs);
    }

    // --- Admin configuration ---

    function setClaimAmount(uint256 _claimAmount) external onlyOwner {
        require(_claimAmount > 0, "Claim amount = 0");
        uint256 old = claimAmount;
        claimAmount = _claimAmount;
        emit ClaimAmountUpdated(old, _claimAmount);
    }

    function setClaimCooldown(uint256 _claimCooldown) external onlyOwner {
        require(_claimCooldown > 0, "Cooldown = 0");
        uint256 old = claimCooldown;
        claimCooldown = _claimCooldown;
        emit ClaimCooldownUpdated(old, _claimCooldown);
    }
}
