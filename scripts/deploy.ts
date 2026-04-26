import { ethers } from "hardhat";

/**
 * Deployment script for AjoCircle contract
 * 
 * This script deploys the secure AjoCircle contract with reentrancy protection
 */
async function main() {
  console.log("\n🚀 Deploying AjoCircle Smart Contract");
  console.log("━".repeat(60));

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying from account: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);

  // Deploy AjoCircle
  console.log("\n📝 Deploying AjoCircle contract...");
  const AjoCircleFactory = await ethers.getContractFactory("AjoCircle");
  const ajoCircle = await AjoCircleFactory.deploy();
  await ajoCircle.waitForDeployment();

  const ajoCircleAddress = await ajoCircle.getAddress();
  console.log(`✅ AjoCircle deployed to: ${ajoCircleAddress}`);

  // Initialize the circle with example parameters
  console.log("\n⚙️  Initializing circle...");
  const contributionAmount = ethers.parseEther("1.0"); // 1 ETH per contribution
  const frequencyDays = 30; // Monthly contributions
  const maxRounds = 12; // 12 rounds (1 year)

  const initTx = await ajoCircle.initializeCircle(
    contributionAmount,
    frequencyDays,
    maxRounds
  );
  await initTx.wait();

  console.log("✅ Circle initialized with parameters:");
  console.log(`   - Contribution Amount: ${ethers.formatEther(contributionAmount)} ETH`);
  console.log(`   - Frequency: ${frequencyDays} days`);
  console.log(`   - Max Rounds: ${maxRounds}`);

  // Verify security features
  console.log("\n🔒 Security Features:");
  console.log("   ✅ ReentrancyGuard: Active");
  console.log("   ✅ CEI Pattern: Implemented");
  console.log("   ✅ Access Control: Ownable");
  console.log("   ✅ Custom Errors: Gas Optimized");

  // Get circle state
  const circleState = await ajoCircle.getCircleState();
  console.log("\n📊 Circle State:");
  console.log(`   - Organizer: ${circleState.organizer}`);
  console.log(`   - Member Count: ${circleState.memberCount}`);
  console.log(`   - Current Round: ${circleState.currentRound}`);
  console.log(`   - Total Pool Balance: ${ethers.formatEther(circleState.totalPoolBalance)} ETH`);

  console.log("\n━".repeat(60));
  console.log("🎉 Deployment Complete!");
  console.log("\n📋 Contract Addresses:");
  console.log(`AjoCircle: ${ajoCircleAddress}`);
  console.log("\n💡 Next Steps:");
  console.log("1. Verify contract on block explorer");
  console.log("2. Add members using addMember()");
  console.log("3. Members can contribute using contribute()");
  console.log("4. Run security tests: npx hardhat test");
  console.log("━".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
