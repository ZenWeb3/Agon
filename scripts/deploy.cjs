// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Starter policy parameters (testnet 0G has 18 decimals like ETH)
  const agent = process.env.AGENT_ADDRESS || deployer.address;
  const spendCap = hre.ethers.parseEther("0.1");   // max 0.1 0G per window
  const maxPerTrade = hre.ethers.parseEther("0.02"); // max 0.02 0G per trade
  const window = 3600;   // 1-hour rolling window
  const cooldown = 300;  // 5-minute cooldown between trades

  const EdgeVault = await hre.ethers.getContractFactory("EdgeVault");
  const vault = await EdgeVault.deploy(agent, spendCap, maxPerTrade, window, cooldown);
  await vault.waitForDeployment();

  const address = await vault.getAddress();
  console.log("EdgeVault deployed to:", address);
  console.log("Explorer: https://chainscan-galileo.0g.ai/address/" + address);
  console.log("\nNext: set VAULT_ADDRESS in .env, allowlist a target, and fund it.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
