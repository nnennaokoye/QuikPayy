// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../contracts/QuikPay.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {
        _mint(msg.sender, 1000000 * 10**18);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PayOkTest is Test {
    QuikPay public quikpay;
    MockERC20 public mockToken;
    address public receiver = address(0x1);
    address public payer = address(0x2);

    function setUp() public {
        quikpay = new QuikPay();
        mockToken = new MockERC20();
        
        // Give payer some ETH
        vm.deal(payer, 10 ether);
        
        // Give payer some tokens
        mockToken.mint(payer, 1000 * 10**18);
    }

    // ETH payment functionality removed - QuikPay is now ERC20-only

    function testPayERC20Bill() public {
        // Receiver creates bill
        vm.prank(receiver);
        bytes32 billId = keccak256(abi.encodePacked(receiver, uint256(2)));
        uint256 amount = 100 * 10**18;
        quikpay.createBill(billId, address(mockToken), amount);

        uint256 receiverBalanceBefore = mockToken.balanceOf(receiver);
        uint256 payerBalanceBefore = mockToken.balanceOf(payer);

        // Payer approves and pays bill
        vm.startPrank(payer);
        mockToken.approve(address(quikpay), amount);
        
        vm.expectEmit(true, true, true, true);
        emit QuikPay.BillPaid(billId, payer, receiver, address(mockToken), amount, block.timestamp);
        
        quikpay.payBill(billId);
        vm.stopPrank();

        // Check balances
        assertEq(mockToken.balanceOf(receiver), receiverBalanceBefore + amount);
        assertEq(mockToken.balanceOf(payer), payerBalanceBefore - amount);

        // Check bill status
        QuikPay.Bill memory bill = quikpay.getBill(billId);
        assertEq(bill.paid, true);
        assertEq(bill.payer, payer);
        assertEq(bill.paidAt, block.timestamp);
    }

    function testPayMultipleERC20Bills() public {
        // Create multiple ERC20 bills
        vm.startPrank(receiver);
        bytes32 billId1 = keccak256(abi.encodePacked(receiver, uint256(1)));
        bytes32 billId2 = keccak256(abi.encodePacked(receiver, uint256(2)));
        
        quikpay.createBill(billId1, address(mockToken), 25 * 10**18);
        quikpay.createBill(billId2, address(mockToken), 50 * 10**18);
        vm.stopPrank();

        // Pay both ERC20 bills
        vm.startPrank(payer);
        mockToken.approve(address(quikpay), 75 * 10**18);
        quikpay.payBill(billId1);
        quikpay.payBill(billId2);
        vm.stopPrank();

        // Check both bills are paid
        assertEq(quikpay.totalPaidBills(), 2);
        
        QuikPay.Bill memory bill1 = quikpay.getBill(billId1);
        QuikPay.Bill memory bill2 = quikpay.getBill(billId2);
        
        assertEq(bill1.paid, true);
        assertEq(bill2.paid, true);
        assertEq(bill1.payer, payer);
        assertEq(bill2.payer, payer);
    }

    function testPayERC20BillWithDifferentPayer() public {
        address anotherPayer = address(0x3);
        mockToken.mint(anotherPayer, 200 * 10**18);

        vm.prank(receiver);
        bytes32 billId = keccak256(abi.encodePacked(receiver, uint256(1)));
        uint256 amount = 100 * 10**18;
        quikpay.createBill(billId, address(mockToken), amount);

        vm.startPrank(anotherPayer);
        mockToken.approve(address(quikpay), amount);
        quikpay.payBill(billId);
        vm.stopPrank();

        QuikPay.Bill memory bill = quikpay.getBill(billId);
        assertEq(bill.payer, anotherPayer);
        assertEq(bill.paid, true);
    }

    function testPayERC20BillWithSufficientBalance() public {
        uint256 billAmount = 100 * 10**18;
        uint256 payerTokens = 200 * 10**18;
        
        // Give payer more tokens than needed
        mockToken.mint(payer, payerTokens);
        
        vm.prank(receiver);
        bytes32 billId = keccak256(abi.encodePacked(receiver, uint256(1)));
        quikpay.createBill(billId, address(mockToken), billAmount);

        vm.startPrank(payer);
        mockToken.approve(address(quikpay), billAmount);
        quikpay.payBill(billId);
        vm.stopPrank();

        // Check only the bill amount was transferred
        assertEq(mockToken.balanceOf(receiver), billAmount);
        assertEq(mockToken.balanceOf(payer), payerTokens - billAmount);
    }

    function testERC20BillTimestamps() public {
        vm.prank(receiver);
        bytes32 billId = keccak256(abi.encodePacked(receiver, uint256(1)));
        uint256 amount = 100 * 10**18;
        
        uint256 creationTime = block.timestamp;
        quikpay.createBill(billId, address(mockToken), amount);

        // Fast forward time
        vm.warp(block.timestamp + 1000);
        
        uint256 paymentTime = block.timestamp;
        vm.startPrank(payer);
        mockToken.approve(address(quikpay), amount);
        quikpay.payBill(billId);
        vm.stopPrank();

        QuikPay.Bill memory bill = quikpay.getBill(billId);
        assertEq(bill.createdAt, creationTime);
        assertEq(bill.paidAt, paymentTime);
        assertGt(bill.paidAt, bill.createdAt);
    }
} 