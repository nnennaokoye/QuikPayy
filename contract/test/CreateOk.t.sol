// test/CreateOk.t.sol
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

contract CreateOkTest is Test {
    QuikPay public quikpay;
    MockERC20 public mockToken;
    address public receiver = address(0x1);
    address public payer = address(0x2);

    function setUp() public {
        quikpay = new QuikPay();
        mockToken = new MockERC20();
        mockToken.mint(payer, 1000 * 10**18);
    }

    // Existing test cases...

    // New Test: Create bill with maximum possible amount
    function testCreateBillWithMaxAmount() public {
        uint256 maxAmount = type(uint256).max;
        bytes32 billId = keccak256(abi.encodePacked(receiver, uint256(1)));
        
        vm.prank(receiver);
        quikpay.createBill(billId, address(mockToken), maxAmount);
        
        (bool exists, bool isPaid) = quikpay.billStatus(billId);
        assertTrue(exists, "Bill should exist");
        assertFalse(isPaid, "Bill should not be paid");
    }

    // New Test: Create multiple bills from different senders
    function testCreateBillsFromMultipleSenders() public {
        address[3] memory senders = [address(0x10), address(0x11), address(0x12)];
        
        for (uint i = 0; i < senders.length; i++) {
            bytes32 billId = keccak256(abi.encodePacked(senders[i], i + 1));
            vm.prank(senders[i]);
            quikpay.createBill(billId, address(mockToken), 100);
            
            (bool exists, ) = quikpay.billStatus(billId);
            assertTrue(exists, "Bill should exist");
        }
        
        assertEq(quikpay.totalBills(), 3, "Should have 3 total bills");
    }

    // New Test: Create bill with zero amount (should fail)
    function testCreateBillWithZeroAmount() public {
        bytes32 billId = keccak256(abi.encodePacked(receiver, uint256(1)));
        
        vm.prank(receiver);
        vm.expectRevert("Amount must be > 0");
        quikpay.createBill(billId, address(mockToken), 0);
    }

    // New Test: Create bill with non-existent token (should still work)
    function testCreateBillWithNonExistentToken() public {
        address nonExistentToken = address(0xDEADBEEF);
        bytes32 billId = keccak256(abi.encodePacked(receiver, uint256(1)));
        
        vm.prank(receiver);
        quikpay.createBill(billId, nonExistentToken, 100);
        
        (bool exists, ) = quikpay.billStatus(billId);
        assertTrue(exists, "Bill should exist with non-existent token");
    }

    // New Test: Create duplicate bill (should fail)
    function testCreateDuplicateBill() public {
        bytes32 billId = keccak256(abi.encodePacked(receiver, uint256(1)));
        
        // First creation should succeed
        vm.prank(receiver);
        quikpay.createBill(billId, address(mockToken), 100);
        
        // Second creation should fail
        vm.prank(receiver);
        vm.expectRevert("Bill already exists");
        quikpay.createBill(billId, address(mockToken), 100);
    }

    // New Test: Verify event emission on bill creation
    function testCreateBillEmitsEvent() public {
        bytes32 billId = keccak256(abi.encodePacked(receiver, uint256(1)));
        uint256 amount = 100;
        
        vm.expectEmit(true, true, true, true);
        emit QuikPay.BillCreated(billId, receiver, address(mockToken), amount, block.timestamp);
        
        vm.prank(receiver);
        quikpay.createBill(billId, address(mockToken), amount);
    }
}