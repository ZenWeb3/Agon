
// The autonomous decision step. Pulls a market snapshot, asks a model running on
// the 0G Compute Network (Router = OpenAI-compatible endpoint) for a position,
// and submits it through EdgeVault.executeTrade so it passes the on-chain policy gate.
//
// 0G component: COMPUTE (verifiable inference). The Router signs responses in a TEE,
// so the decision is provably the authorized model — not a black box on your server.

import OpenAI from "openai";
import { ethers } from "ethers";
import crypto from "crypto";
import "dotenv/config";


const compute = new OpenAI({
  apiKey: process.env.ZG_COMPUTE_API_KEY,
  baseURL: process.env.ZG_COMPUTE_BASE_URL,
});

const MODEL = process.env.ZG_COMPUTE_MODEL;

// --- market snapshot (STUB) ---
// TODO: replace with a real feed for your chosen market (e.g. an outcome market,
// a price oracle, or a DEX pool). The agent is only as good as this input.
async function getMarketSnapshot() {
  return {
    market: "EXAMPLE-OUTCOME-MARKET",
    yesPrice: 0.62,
    noPrice: 0.38,
    volume24h: 154000,
    trend: "yes-side accumulating over last 6h",
  };
}

// Ask 0G Compute for a structured decision.
async function decide(snapshot) {
  const system =
    "You are a disciplined trading agent. Given a market snapshot, return ONLY " +
    'JSON: {"action":"BUY"|"SELL"|"HOLD","sizeFraction":0..1,' +
    '"rationale":"..."}. No prose, no markdown.';

  const res = await compute.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(snapshot) },
    ],
    temperature: 0.2,
    verify_tee: true, // ask the 0G Compute Router for a TEE attestation
  });
  console.log("RAW:", JSON.stringify(res, null, 2));

  // 0G returns whether the inference ran inside a verified TEE.
  const trace = res.x_0g_trace || {};
  const text = res.choices[0].message.content
    .replace(/```json|```/g, "")
    .trim();
  const decision = JSON.parse(text);
  decision.teeVerified = trace.tee_verified ?? null;
  decision.teeProvider = trace.provider ?? null;
  decision.teeRequestId = trace.request_id ?? null;
  return decision;
}

// Submit the decision through the policy gate.
async function submit(decision, snapshot) {
  if (decision.action === "HOLD") {
    console.log("Decision: HOLD —", decision.rationale);
    return;
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider);

  const abi = [
    "function executeTrade(address target,uint256 amount,bytes32 decisionRef,bytes payload) returns (uint256)",
    "function maxPerTrade() view returns (uint256)",
    "function remainingWindowBudget() view returns (uint256)",
  ];
  const vault = new ethers.Contract(process.env.VAULT_ADDRESS, abi, wallet);

  // size the trade against the on-chain limits the contract will enforce anyway
  const maxPerTrade = await vault.maxPerTrade();
  const amount =
    (BigInt(Math.floor(decision.sizeFraction * 1e6)) * maxPerTrade) /
    1_000_000n;

  // verifiable reference to the decision (later: store full decision on 0G Storage)
  const decisionRef =
    "0x" +
    crypto
      .createHash("sha256")
      .update(JSON.stringify({ snapshot, decision }))
      .digest("hex");

  const target = process.env.TARGET_MARKET; // allowlisted destination
  console.log(`Submitting ${decision.action} size=${amount} -> ${target}`);

  try {
    const tx = await vault.executeTrade(target, amount, decisionRef, "0x");
    const receipt = await tx.wait();
    console.log("Trade mined:", receipt.hash);
  } catch (e) {
    console.log(
      "Trade blocked by policy gate:",
      e.reason || e.shortMessage || e.message,
    );
  }
}

async function main() {
  const snapshot = await getMarketSnapshot();
  const decision = await decide(snapshot);
  console.log("0G Compute decision:", decision);
  console.log(
    `TEE verified: ${decision.teeVerified} (provider ${decision.teeProvider})`,
  );
  await submit(decision, snapshot);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
