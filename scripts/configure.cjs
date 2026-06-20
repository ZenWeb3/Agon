const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const vaultAddr = process.env.VAULT_ADDRESS;
  const target = process.env.TARGET_MARKET;
  if (!vaultAddr || !target) throw new Error("Set VAULT_ADDRESS and TARGET_MARKET in .env");

  const vault = await hre.ethers.getContractAt("EdgeVault", vaultAddr);

  const tx1 = await vault.setAllowed(target, true);
  await tx1.wait();
  console.log("Allowlisted:", target);

  const tx2 = await vault.deposit({ value: hre.ethers.parseEther("0.05") });
  await tx2.wait();
  console.log("Funded vault with 0.05 0G");

  const bal = await hre.ethers.provider.getBalance(vaultAddr);
  console.log("Vault balance:", hre.ethers.formatEther(bal), "0G");
}

main().catch((e) => { console.error(e); process.exit(1); });