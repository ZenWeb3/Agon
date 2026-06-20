const { expect } = require("chai");
const hre = require("hardhat");
const { ethers } = hre;

describe("EdgeVault", function () {
  let vault, owner, agent, target, other;
  const spendCap = ethers.parseEther("0.1");
  const maxPerTrade = ethers.parseEther("0.02");
  const window = 3600;
  const cooldown = 300;
  const ref = ethers.id("decision-ref");

  beforeEach(async function () {
    [owner, agent, target, other] = await ethers.getSigners();
    const EdgeVault = await ethers.getContractFactory("EdgeVault");
    vault = await EdgeVault.deploy(agent.address, spendCap, maxPerTrade, window, cooldown);
    await vault.waitForDeployment();
    await vault.deposit({ value: ethers.parseEther("0.2") }); // headroom above cap
    await vault.setAllowed(target.address, true);
  });

  it("sets owner and agent", async function () {
    expect(await vault.owner()).to.equal(owner.address);
    expect(await vault.agent()).to.equal(agent.address);
  });

  it("executes a valid trade and emits the event", async function () {
    await expect(vault.connect(agent).executeTrade(target.address, maxPerTrade, ref, "0x"))
      .to.emit(vault, "TradeExecuted");
    expect(await vault.tradeCount()).to.equal(1n);
  });

  it("policy 1: rejects non-agent callers", async function () {
    await expect(vault.connect(other).executeTrade(target.address, maxPerTrade, ref, "0x"))
      .to.be.revertedWith("not agent");
  });

  it("policy 2: rejects non-allowlisted target", async function () {
    await expect(vault.connect(agent).executeTrade(other.address, maxPerTrade, ref, "0x"))
      .to.be.revertedWith("target not allowed");
  });

  it("policy 3: rejects trade above per-trade cap", async function () {
    await expect(vault.connect(agent).executeTrade(target.address, ethers.parseEther("0.03"), ref, "0x"))
      .to.be.revertedWith("exceeds max per trade");
  });

  it("policy 5: enforces cooldown between trades", async function () {
    await vault.connect(agent).executeTrade(target.address, maxPerTrade, ref, "0x");
    await expect(vault.connect(agent).executeTrade(target.address, maxPerTrade, ref, "0x"))
      .to.be.revertedWith("cooldown active");
  });

  it("policy 4: enforces the rolling window spend cap", async function () {
    for (let i = 0; i < 5; i++) {
      await vault.connect(agent).executeTrade(target.address, maxPerTrade, ref, "0x");
      await ethers.provider.send("evm_increaseTime", [cooldown + 1]);
      await ethers.provider.send("evm_mine", []);
    }
    await expect(vault.connect(agent).executeTrade(target.address, maxPerTrade, ref, "0x"))
      .to.be.revertedWith("exceeds window spend cap");
  });

  it("resets the window after it elapses", async function () {
    for (let i = 0; i < 5; i++) {
      await vault.connect(agent).executeTrade(target.address, maxPerTrade, ref, "0x");
      await ethers.provider.send("evm_increaseTime", [cooldown + 1]);
      await ethers.provider.send("evm_mine", []);
    }
    await ethers.provider.send("evm_increaseTime", [window]);
    await ethers.provider.send("evm_mine", []);
    await expect(vault.connect(agent).executeTrade(target.address, maxPerTrade, ref, "0x"))
      .to.emit(vault, "TradeExecuted");
  });

  it("policy 6: rejects when balance is insufficient", async function () {
    await vault.withdraw(ethers.parseEther("0.2"));
    await expect(vault.connect(agent).executeTrade(target.address, maxPerTrade, ref, "0x"))
      .to.be.revertedWith("insufficient balance");
  });

  it("records an outcome for the leaderboard", async function () {
    await vault.connect(agent).executeTrade(target.address, maxPerTrade, ref, "0x");
    await expect(vault.recordOutcome(1, ethers.parseEther("0.005")))
      .to.emit(vault, "OutcomeRecorded");
  });
});