// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @dev Minimal ERC20 Permit interface (EIP-2612)
interface IERC20Permit {
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;
}

/**
 * @title QuikPay
 * @dev Smart contract for creating and paying bills via payment links
 * @author QuikPay Team
 */
contract QuikPay is ReentrancyGuard {
    struct Bill {
        address receiver;
        address token; // ERC20 token address only
        uint256 amount;
        bool paid;
        bool canceled;
        uint256 createdAt;
        uint256 paidAt;
        address payer;
    }

    // Fee configuration
    address public constant FEE_RECIPIENT = 0x167142915AD0fAADD84d9741eC253B82aB8625cd;
    uint16 public constant FEE_BPS = 3; // 0.03%


    /**
     * @dev Pay dynamically in ERC20 using merchant auth + payer EIP-2612 permit.
     * Merchant signs (receiver, token, chainId, contractAddress).
     * Payer provides a permit for exact amount; any sender can relay this tx (sponsored gas).
     */
    function payDynamicERC20WithPermit(
        PayAuthorization calldata auth,
        PermitData calldata permit
    ) external nonReentrant {
        if (!_verifyPayAuthorization(auth)) {
            revert InvalidAuthorization();
        }
        require(auth.token != address(0), "Invalid token address");
        require(auth.token == permit.token, "Token mismatch");
        require(permit.owner != address(0), "Invalid owner");
        require(permit.value > 0, "Invalid amount");

        // Execute permit to approve this contract to pull funds
        IERC20Permit(permit.token).permit(
            permit.owner,
            address(this),
            permit.value,
            permit.deadline,
            permit.v,
            permit.r,
            permit.s
        );

        // Pull funds from payer to this contract, then split to fee recipient and merchant
        IERC20 token = IERC20(permit.token);
        bool pulled = token.transferFrom(permit.owner, address(this), permit.value);
        if (!pulled) {
            revert TransferFailed();
        }

        uint256 fee = (permit.value * FEE_BPS) / 10000;
        uint256 toMerchant = permit.value - fee;

        bool feeSent = token.transfer(FEE_RECIPIENT, fee);
        if (!feeSent) {
            revert TransferFailed();
        }
        bool merchantSent = token.transfer(auth.receiver, toMerchant);
        if (!merchantSent) {
            revert TransferFailed();
        }

        emit DynamicErc20Paid(auth.receiver, permit.owner, permit.token, permit.value, block.timestamp);
    }

    struct Authorization {
        address authorizer;
        bytes32 billId;
        uint256 nonce;
        uint256 chainId;
        address contractAddress;
        bytes signature;
    }

    // Merchant-signed authorization for dynamic payments (no stored bill)
    struct PayAuthorization {
        address receiver;         // Merchant address (intended receiver)
        address token;            // ERC20 token address
        uint256 chainId;          // Target chain id
        address contractAddress;  // This contract address
        bytes signature;          // Signature by receiver (merchant)
    }

    // EIP-2612 permit data for payer approval
    struct PermitData {
        address owner;      // Payer
        address token;      // ERC20 token address
        uint256 value;      // Amount to approve/pay
        uint256 deadline;   // Permit deadline
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    mapping(bytes32 => Bill) public bills;
    mapping(address => bytes32[]) public userBills;
    mapping(address => uint256) public nonces;
    
    uint256 public totalBills;
    uint256 public totalPaidBills;
    // Default expiration window for unpaid bills: 72 hours (3 days)
    uint256 public constant BILL_EXPIRY_SECONDS = 72 hours;
    
    event BillCreated(
        bytes32 indexed billId,
        address indexed receiver,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );
    
    event BillPaid(
        bytes32 indexed billId,
        address indexed payer,
        address indexed receiver,
        address token,
        uint256 amount,
        uint256 timestamp
    );

    event BillExpired(
        bytes32 indexed billId,
        address indexed receiver,
        uint256 timestamp
    );

    // Event for dynamic ERC20 payments
    event DynamicErc20Paid(
        address indexed receiver,
        address indexed payer,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );

    error BillAlreadyExists();
    error BillNotFound();
    error BillAlreadyPaid();
    error InvalidAmount();
    error InsufficientBalance();
    error TransferFailed();
    error InvalidAuthorization();
    error InvalidNonce();

    constructor() {}

    /**
     * @dev Create a new bill with unique ID
     * @param billId Unique identifier for the bill
     * @param token ERC20 token address
     * @param amount Amount to be paid
     */
    function createBill(
        bytes32 billId,
        address token,
        uint256 amount
    ) external {
        if (bills[billId].receiver != address(0)) {
            revert BillAlreadyExists();
        }
        if (amount == 0) {
            revert InvalidAmount();
        }
        if (token == address(0)) {
            revert InvalidAmount();
        }

        bills[billId] = Bill({
            receiver: msg.sender,
            token: token,
            amount: amount,
            paid: false,
            canceled: false,
            createdAt: block.timestamp,
            paidAt: 0,
            payer: address(0)
        });

        userBills[msg.sender].push(billId);
        totalBills++;

        emit BillCreated(billId, msg.sender, token, amount, block.timestamp);
    }

    /**
     * @dev Pay an existing bill (standard method)
     * @param billId ID of the bill to pay
     */
    function payBill(bytes32 billId) external nonReentrant {
        _payBill(billId, msg.sender);
    }

    /**
     * This allows a sponsor/relayer to pay gas fees while the actual payment comes from the authorizer
     * @param authorization The authorization struct containing signature and details
     */
    function payBillWithAuthorization(
        Authorization calldata authorization
    ) external nonReentrant {
        // Verify the authorization
        if (!_verifyAuthorization(authorization)) {
            revert InvalidAuthorization();
        }
        
        // Check nonce
        if (authorization.nonce != nonces[authorization.authorizer]) {
            revert InvalidNonce();
        }
        
        // Increment nonce
        nonces[authorization.authorizer]++;
        
        // Get bill details
        Bill storage bill = bills[authorization.billId];
        
        if (bill.receiver == address(0)) {
            revert BillNotFound();
        }
        require(!bill.canceled, "Bill canceled");
        if (bill.paid) {
            revert BillAlreadyPaid();
        }

        // ERC20 transfer: pull to contract then split
        IERC20 token = IERC20(bill.token);
        if (token.balanceOf(authorization.authorizer) < bill.amount) {
            revert InsufficientBalance();
        }

        bool pulled = token.transferFrom(authorization.authorizer, address(this), bill.amount);
        if (!pulled) {
            revert TransferFailed();
        }

        uint256 fee = (bill.amount * FEE_BPS) / 10000;
        uint256 toMerchant = bill.amount - fee;

        bool feeSent = token.transfer(FEE_RECIPIENT, fee);
        if (!feeSent) {
            revert TransferFailed();
        }
        bool merchantSent = token.transfer(bill.receiver, toMerchant);
        if (!merchantSent) {
            revert TransferFailed();
        }

        // Update bill status
        bill.paid = true;
        bill.paidAt = block.timestamp;
        bill.payer = authorization.authorizer;
        totalPaidBills++;

        emit BillPaid(
            authorization.billId,
            authorization.authorizer,
            bill.receiver,
            bill.token,
            bill.amount,
            block.timestamp
        );
    }

    /**
     * @dev Internal function to process standard bill payment
     */
    function _payBill(bytes32 billId, address payer) internal {
        Bill storage bill = bills[billId];
        
        if (bill.receiver == address(0)) {
            revert BillNotFound();
        }
        require(!bill.canceled, "Bill canceled");
        if (bill.paid) {
            revert BillAlreadyPaid();
        }

        // ERC20 payment only: pull to contract then split
        IERC20 token = IERC20(bill.token);
        if (token.balanceOf(payer) < bill.amount) {
            revert InsufficientBalance();
        }

        bool pulled = token.transferFrom(payer, address(this), bill.amount);
        if (!pulled) {
            revert TransferFailed();
        }

        uint256 fee = (bill.amount * FEE_BPS) / 10000;
        uint256 toMerchant = bill.amount - fee;

        bool feeSent = token.transfer(FEE_RECIPIENT, fee);
        if (!feeSent) {
            revert TransferFailed();
        }
        bool merchantSent = token.transfer(bill.receiver, toMerchant);
        if (!merchantSent) {
            revert TransferFailed();
        }

        bill.paid = true;
        bill.paidAt = block.timestamp;
        bill.payer = payer;
        totalPaidBills++;

        emit BillPaid(
            billId,
            payer,
            bill.receiver,
            bill.token,
            bill.amount,
            block.timestamp
        );
    }

    /**
     * @dev Expire old unpaid bills for a receiver. Can be called by anyone to clean up expired bills.
     * Iterates over the receiver's bills and marks up to `maxToExpire` that are unpaid, not canceled,
     * and older than BILL_EXPIRY_SECONDS as canceled, emitting BillExpired events.
     * This function is idempotent and permissionless.
     */
    function expireOldBills(address receiver, uint256 maxToExpire) public {
        require(maxToExpire > 0, "maxToExpire=0");
        bytes32[] storage list = userBills[receiver];
        uint256 len = list.length;
        uint256 expired;
        for (uint256 i = 0; i < len && expired < maxToExpire; i++) {
            bytes32 billId = list[i];
            Bill storage bill = bills[billId];
            if (
                bill.receiver == receiver &&
                !bill.paid &&
                !bill.canceled &&
                bill.createdAt + BILL_EXPIRY_SECONDS <= block.timestamp
            ) {
                bill.canceled = true;
                emit BillExpired(billId, receiver, block.timestamp);
                expired++;
            }
        }
    }


    /**
     * @dev Check if a user has expired bills that can be cleaned up
     * @param receiver The address to check for expired bills
     * @return hasExpired True if there are expired bills for this receiver
     */
    function hasExpiredBills(address receiver) external view returns (bool hasExpired) {
        if (receiver == address(0)) {
            return false;
        }
        bytes32[] storage list = userBills[receiver];
        uint256 len = list.length;
        for (uint256 i = 0; i < len; i++) {
            Bill storage bill = bills[list[i]];
            if (
                bill.receiver == receiver &&
                !bill.paid &&
                !bill.canceled &&
                bill.createdAt + BILL_EXPIRY_SECONDS <= block.timestamp
            ) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Verify signed authorization
     */
    function _verifyAuthorization(Authorization calldata auth) internal view returns (bool) {
        // Create the message hash that was signed
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(
                    abi.encode(
                        auth.billId,
                        auth.nonce,
                        auth.chainId,
                        auth.contractAddress
                    )
                )
            )
        );
        
        // Recover signer from signature
        address signer = _recoverSigner(messageHash, auth.signature);
        
        // Verify the signer matches the authorizer
        return signer == auth.authorizer && 
               auth.chainId == block.chainid && 
               auth.contractAddress == address(this);
    }

    /**
     * @dev Verify merchant-signed dynamic payment authorization.
     * Message: keccak256(abi.encode(receiver, token, chainId, contractAddress)) with EIP-191 prefix.
     */
    function _verifyPayAuthorization(PayAuthorization calldata auth) internal view returns (bool) {
        // Since personal_sign already applies EIP-191 prefix, we need to reconstruct the exact message that was signed
        bytes32 innerHash = keccak256(
            abi.encode(
                auth.receiver,
                auth.token,
                auth.chainId,
                auth.contractAddress
            )
        );
        
        // personal_sign creates: keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", innerHash))
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                innerHash
            )
        );

        address signer = _recoverSigner(messageHash, auth.signature);
        return signer == auth.receiver && auth.chainId == block.chainid && auth.contractAddress == address(this);
    }

    /**
     * @dev Recover signer address from signature
     */
    function _recoverSigner(bytes32 messageHash, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        if (v < 27) {
            v += 27;
        }
        
        require(v == 27 || v == 28, "Invalid signature v value");
        
        return ecrecover(messageHash, v, r, s);
    }

    /**
     * @dev Get bill details
     */
    function getBill(bytes32 billId) external view returns (Bill memory) {
        return bills[billId];
    }

    /**
     * @dev Get all bills created by a user
     */
    function getUserBills(address user) external view returns (bytes32[] memory) {
        return userBills[user];
    }

    /**
     * @dev Check if a bill exists and is unpaid
     */
    function billStatus(bytes32 billId) external view returns (bool exists, bool isPaid) {
        Bill memory bill = bills[billId];
        exists = bill.receiver != address(0);
        isPaid = bill.paid;
    }

    /**
     * @dev Generate a unique bill ID
     */
    function generateBillId(address user, uint256 nonce) external view returns (bytes32) {
        return keccak256(abi.encodePacked(user, nonce, block.timestamp));
    }

    /**
     * @dev Get current nonce for an address
     */
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }
} 