// test/PayOk.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/QuikPay.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20WithPermit is ERC20 {
    constructor() ERC20("Mock Token with Permit", "MOCKP") {
        _mint(msg.sender, 1000000 * 10**18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    // Mock permit function for testing
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // In a real implementation, this would verify the signature
        _approve(owner, spender, value);
    }
}

contract PayOkTest is Test {
    QuikPay public quikpay;
    MockERC20 public mockToken;
    MockERC20WithPermit public mockTokenWithPermit;
    address public receiver = address(0x1);
    address public payer = address(0x2);
    address public feeRecipient = 0x167142915AD0fAADD84d9741eC253B82aB8625cd;

    function setUp() public {
        quikpay = new QuikPay();
        mockToken = new MockERC20();
        mockTokenWithPermit = new MockERC20WithPermit();
        
        // Fund payer with both token types
        mockToken.mint(payer, 1000 * 10**18);
        mockTokenWithPermit.mint(payer, 1000 * 10**18);
    }

    // Helper function to create a bill
    function createBill(
        address token,
        uint256 amount
    ) internal returns (bytes32) {
        bytes32 billId = keccak256(abi.encodePacked(receiver, block.timestamp, amount));
        vm.prank(receiver);
        quikpay.createBill(billId, token, amount);
        return billId;
    }

    // Existing test cases...

    // New Test: Pay bill with exact token amount
    function testPayBillWithExactAmount() public {
        uint256 amount = 100 * 10**18;
        bytes32 billId = createBill(address(mockToken), amount);
        
        uint256 fee = (amount * 3) / 10000; // 0.03% fee
        uint256 amountAfterFee = amount - fee;
        
        vm.startPrank(payer);
        mockToken.approve(address(quikpay), amount);
        quikpay.payBill(billId);
        
        // Verify balances
        assertEq(mockToken.balanceOf(receiver), amountAfterFee, "Merchant should receive amount after fee");
        assertEq(mockToken.balanceOf(feeRecipient), fee, "Fee recipient should receive fee");
        assertEq(mockToken.balanceOf(payer), 1000 * 10**18 - amount, "Payer balance should be reduced by amount");
        
        // Verify bill status
        (bool exists, bool isPaid) = quikpay.billStatus(billId);
        assertTrue(exists, "Bill should exist");
        assertTrue(isPaid, "Bill should be marked as paid");
    }

    // New Test: Pay with permit (gasless approval)
    function testPayWithPermit() public {
        uint256 amount = 100 * 10**18;
        bytes32 billId = createBill(address(mockTokenWithPermit), amount);
        
        // Create permit data (values don't matter for mock token)
        QuikPay.PermitData memory permitData = QuikPay.PermitData({
            value: amount,
            deadline: block.timestamp + 1 hours,
            v: 27,
            r: 0x0000000000000000000000000000000000000000000000000000000000000001,
            s: 0x0000000000000000000000000000000000000000000000000000000000000002
        });

        // Create authorization
        QuikPay.PayAuthorization memory auth = QuikPay.PayAuthorization({
            receiver: receiver,
            token: address(mockTokenWithPermit),
            amount: amount,
            billId: billId,
            nonce: 0,
            signature: new bytes(0) // Not used in test
        });

        // Pay with permit
        vm.prank(payer);
        quikpay.payDynamicERC20WithPermit(auth, permitData);

        // Verify payment
        (bool exists, bool isPaid) = quikpay.billStatus(billId);
        assertTrue(exists, "Bill should exist");
        assertTrue(isPaid, "Bill should be paid with permit");
    }

    // New Test: Pay bill with insufficient allowance (should fail)
    function testPayBillWithInsufficientAllowance() public {
        uint256 amount = 100 * 10**18;
        bytes32 billId = createBill(address(mockToken), amount);
        
        // Approve less than needed
        vm.startPrank(payer);
        mockToken.approve(address(quikpay), amount - 1);
        
        // Should fail with insufficient allowance
        vm.expectRevert("ERC20: insufficient allowance");
        quikpay.payBill(billId);
    }

    // New Test: Pay bill with insufficient balance (should fail)
    function testPayBillWithInsufficientBalance() public {
        uint256 amount = 100 * 10**18;
        bytes32 billId = createBill(address(mockToken), amount);
        
        // Create a poor payer with not enough balance
        address poorPayer = address(0x999);
        mockToken.mint(poorPayer, amount - 1); // Not enough for the full amount
        
        vm.startPrank(poorPayer);
        mockToken.approve(address(quikpay), amount);
        
        // Should fail with insufficient balance
        vm.expectRevert("ERC20: transfer amount exceeds balance");
        quikpay.payBill(billId);
    }

    // New Test: Pay already paid bill (should fail)
    function testPayAlreadyPaidBill() public {
        uint256 amount = 100 * 10**18;
        bytes32 billId = createBill(address(mockToken), amount);
        
        // First payment should succeed
        vm.startPrank(payer);
        mockToken.approve(address(quikpay), amount);
        quikpay.payBill(billId);
        
        // Second payment should fail
        vm.expectRevert("Bill already paid");
        quikpay.payBill(billId);
    }

    // New Test: Pay non-existent bill (should fail)
    function testPayNonExistentBill() public {
        bytes32 nonExistentBillId = keccak256("non-existent-bill");
        
        vm.prank(payer);
        vm.expectRevert("Bill does not exist");
        quikpay.payBill(nonExistentBillId);
    }
}