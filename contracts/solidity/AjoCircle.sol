// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AjoCircle
 * @notice Secure implementation of an Ajo (ROSCA) savings circle with reentrancy protection
 * @dev Uses ReentrancyGuard and Checks-Effects-Interactions pattern
 */
contract AjoCircle is ReentrancyGuard, Ownable {
    
    // Custom errors for gas optimization
    error InvalidInput();
    error NotFound();
    error Unauthorized();
    error AlreadyExists();
    error AlreadyPaid();
    error InsufficientFunds();
    error TransferFailed();
    
    // Member status enum
    enum MemberStatus { Active, Inactive, Exited }
    
    struct CircleData {
        address organizer;
        uint256 contributionAmount;
        uint32 frequencyDays;
        uint32 maxRounds;
        uint32 currentRound;
        uint32 memberCount;
        uint256 totalPoolBalance;
    }
    
    struct MemberData {
        address memberAddress;
        uint256 totalContributed;
        uint256 totalWithdrawn;
        bool hasReceivedPayout;
        MemberStatus status;
    }
    
    CircleData public circle;
    mapping(address => MemberData) public members;
    address[] public memberList;
    
    // Events for transparency
    event CircleInitialized(address indexed organizer, uint256 contributionAmount, uint32 maxRounds);
    event MemberAdded(address indexed member);
    event ContributionMade(address indexed member, uint256 amount);
    event PayoutClaimed(address indexed member, uint256 amount);
    event PartialWithdrawal(address indexed member, uint256 amount, uint256 penalty);
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @notice Initialize a new Ajo circle
     * @param _contributionAmount Amount each member must contribute per round
     * @param _frequencyDays Number of days between rounds
     * @param _maxRounds Maximum number of rounds in the circle
     */
    function initializeCircle(
        uint256 _contributionAmount,
        uint32 _frequencyDays,
        uint32 _maxRounds
    ) external onlyOwner {
        if (_contributionAmount == 0 || _frequencyDays == 0 || _maxRounds == 0) {
            revert InvalidInput();
        }
        
        circle = CircleData({
            organizer: msg.sender,
            contributionAmount: _contributionAmount,
            frequencyDays: _frequencyDays,
            maxRounds: _maxRounds,
            currentRound: 1,
            memberCount: 1,
            totalPoolBalance: 0
        });
        
        members[msg.sender] = MemberData({
            memberAddress: msg.sender,
            totalContributed: 0,
            totalWithdrawn: 0,
            hasReceivedPayout: false,
            status: MemberStatus.Active
        });
        
        memberList.push(msg.sender);
        
        emit CircleInitialized(msg.sender, _contributionAmount, _maxRounds);
    }
    
    /**
     * @notice Add a new member to the circle
     * @param _newMember Address of the new member to add
     */
    function addMember(address _newMember) external onlyOwner {
        if (_newMember == address(0)) {
            revert InvalidInput();
        }
        
        if (members[_newMember].memberAddress != address(0)) {
            revert AlreadyExists();
        }
        
        members[_newMember] = MemberData({
            memberAddress: _newMember,
            totalContributed: 0,
            totalWithdrawn: 0,
            hasReceivedPayout: false,
            status: MemberStatus.Active
        });
        
        memberList.push(_newMember);
        circle.memberCount++;
        
        emit MemberAdded(_newMember);
    }
    
    /**
     * @notice Record a contribution from a member
     * @dev SECURED: Uses nonReentrant modifier and CEI pattern
     * @dev State changes happen BEFORE external calls
     */
    function contribute() external payable nonReentrant {
        // CHECKS: Validate inputs and state
        if (msg.value == 0) {
            revert InvalidInput();
        }
        
        MemberData storage member = members[msg.sender];
        if (member.memberAddress == address(0)) {
            revert NotFound();
        }
        
        // EFFECTS: Update state BEFORE any external interactions
        member.totalContributed += msg.value;
        circle.totalPoolBalance += msg.value;
        
        // INTERACTIONS: External calls happen LAST
        // (In this case, we're receiving ETH, so no external call needed)
        
        emit ContributionMade(msg.sender, msg.value);
    }
    
    /**
     * @notice Claim payout when it's a member's turn
     * @dev SECURED: Uses nonReentrant modifier and CEI pattern
     * @return payout The amount paid out to the member
     */
    function claimPayout() external nonReentrant returns (uint256 payout) {
        // CHECKS: Validate state and authorization
        MemberData storage member = members[msg.sender];
        if (member.memberAddress == address(0)) {
            revert NotFound();
        }
        
        if (member.hasReceivedPayout) {
            revert AlreadyPaid();
        }
        
        payout = uint256(circle.memberCount) * circle.contributionAmount;
        
        if (address(this).balance < payout) {
            revert InsufficientFunds();
        }
        
        // EFFECTS: Update state BEFORE external call
        member.hasReceivedPayout = true;
        member.totalWithdrawn += payout;
        circle.totalPoolBalance -= payout;
        
        // INTERACTIONS: External call happens LAST
        (bool success, ) = msg.sender.call{value: payout}("");
        if (!success) {
            revert TransferFailed();
        }
        
        emit PayoutClaimed(msg.sender, payout);
    }
    
    /**
     * @notice Perform a partial withdrawal with 10% penalty
     * @dev SECURED: Uses nonReentrant modifier and CEI pattern
     * @param _amount Amount to withdraw (before penalty)
     * @return netAmount Amount actually transferred (after penalty)
     */
    function partialWithdraw(uint256 _amount) external nonReentrant returns (uint256 netAmount) {
        // CHECKS: Validate inputs and state
        if (_amount == 0) {
            revert InvalidInput();
        }
        
        MemberData storage member = members[msg.sender];
        if (member.memberAddress == address(0)) {
            revert NotFound();
        }
        
        uint256 available = member.totalContributed - member.totalWithdrawn;
        if (_amount > available) {
            revert InsufficientFunds();
        }
        
        // Calculate penalty (10%)
        uint256 penalty = (_amount * 10) / 100;
        netAmount = _amount - penalty;
        
        if (address(this).balance < netAmount) {
            revert InsufficientFunds();
        }
        
        // EFFECTS: Update state BEFORE external call
        member.totalWithdrawn += _amount;
        circle.totalPoolBalance -= netAmount;
        
        // INTERACTIONS: External call happens LAST
        (bool success, ) = msg.sender.call{value: netAmount}("");
        if (!success) {
            revert TransferFailed();
        }
        
        emit PartialWithdrawal(msg.sender, netAmount, penalty);
    }
    
    /**
     * @notice Get circle state information
     */
    function getCircleState() external view returns (CircleData memory) {
        return circle;
    }
    
    /**
     * @notice Get member balance and status
     */
    function getMemberBalance(address _member) external view returns (MemberData memory) {
        if (members[_member].memberAddress == address(0)) {
            revert NotFound();
        }
        return members[_member];
    }
    
    /**
     * @notice Get all members
     */
    function getMembers() external view returns (address[] memory) {
        return memberList;
    }
    
    /**
     * @notice Get contract balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
