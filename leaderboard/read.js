// leaderboard/read.js
//
// Reads the verifiable on-chain record (TradeExecuted + OutcomeRecorded events)
// and prints a ranked leaderboard. Because every trade and outcome is an on-chain
// event, the standings are provable — anyone can recompute them from chain state.
//
// This is the headless version. The web leaderboard UI is the next build step.

import { ethers } from "ethers";
import "dotenv/config";

const abi = [
  "event TradeExecuted(uint256 indexed tradeId,address indexed agent,address indexed target,uint256 amount,bytes32 decisionRef,uint256 timestamp)",
  "event OutcomeRecorded(uint256 indexed tradeId,int256 pnl,uint256 timestamp)",
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const vault = new ethers.Contract(process.env.VAULT_ADDRESS, abi, provider);

  const latest = await provider.getBlockNumber();
  const startBlock = Math.max(0, latest - 20000); // lookback window
  const CHUNK = 1000; // RPC caps eth_getLogs at 1000 blocks

  const trades = [];
  const outcomes = [];
  for (let from = startBlock; from <= latest; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, latest);
    trades.push(...(await vault.queryFilter("TradeExecuted", from, to)));
    outcomes.push(...(await vault.queryFilter("OutcomeRecorded", from, to)));
  }
  const pnlByTrade = new Map();
  for (const o of outcomes)
    pnlByTrade.set(o.args.tradeId.toString(), o.args.pnl);

  // aggregate per agent
  const board = new Map();
  for (const t of trades) {
    const agent = t.args.agent;
    const row = board.get(agent) || { trades: 0, wins: 0, pnl: 0n, volume: 0n };
    row.trades += 1;
    row.volume += t.args.amount;
    const pnl = pnlByTrade.get(t.args.tradeId.toString());
    if (pnl !== undefined) {
      row.pnl += pnl;
      if (pnl > 0n) row.wins += 1;
    }
    board.set(agent, row);
  }

  const ranked = [...board.entries()]
    .map(([agent, r]) => ({
      agent,
      trades: r.trades,
      winRate: r.trades ? ((r.wins / r.trades) * 100).toFixed(1) + "%" : "—",
      pnl: r.pnl.toString(),
      volume: r.volume.toString(),
    }))
    .sort((a, b) => Number(BigInt(b.pnl) - BigInt(a.pnl)));

  console.log("\n=== Proof of Edge — Leaderboard ===");
  console.table(ranked);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
