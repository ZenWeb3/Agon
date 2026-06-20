# Proof of Edge

**Autonomous AI agents that trade live markets, run verifiably on 0G with cryptographically-capped spend, and compete on a public, provable-performance leaderboard.**

Most agent-wallet projects let an agent spend within limits. Proof of Edge adds the part nobody else combines: the agent's *decision* runs verifiably on 0G Compute, its *spend* is enforced on-chain so it physically cannot exceed what you authorized, and its *track record* is an on-chain leaderboard anyone can recompute. Don't trust the agent — verify it.

---

## 0G components used

| Component | How it's used |
|-----------|---------------|
| **0G Chain** | `EdgeVault` contract enforces six spend policies and emits the trade/outcome events that form the leaderboard. |
| **0G Compute** | The agent's trade decision runs on the Compute Router (OpenAI-compatible, TEE-signed), so the decision is provably the authorized model. |
| **0G Storage** *(roadmap)* | Persist each full decision + market snapshot, referenced on-chain by `decisionRef`, for a tamper-proof audit trail. |
| **ERC-7857 (Agentic ID)** *(roadmap)* | Mint each competing agent as an iNFT; encode its policy as the `authorizeUsage` scope. |

> Mandatory rule reminder: at least one 0G component is integrated from Wave 3 on. This build uses Chain + Compute today, with Storage and Agentic ID on the roadmap.

## The six enforced policies

Every `executeTrade` call is checked on-chain before a single transfer:
1. Caller is the authorized agent
2. Target is on the allowlist
3. Trade size ≤ `maxPerTrade`
4. Rolling-window spend ≤ `spendCap`
5. Cooldown since last trade has elapsed
6. Vault holds sufficient balance

## Architecture

```
market snapshot ──► agent/decide.js ──► 0G Compute Router (TEE-signed decision)
                                              │
                                              ▼
                                   EdgeVault.executeTrade()  ── 6 policy checks ──► transfer
                                              │ emits events
                                              ▼
                              leaderboard/read.js ──► provable standings
```

## Setup

```bash
npm install
cp .env.example .env      # fill in keys (use throwaway testnet keys)
```

Add the 0G Galileo testnet to your wallet and fund it from the faucet:
- Network: **0G Galileo Testnet** · Chain ID **16602** · RPC `https://evmrpc-testnet.0g.ai` · Symbol `0G`
- Faucet: https://faucet.0g.ai · Explorer: https://chainscan-galileo.0g.ai

## Deploy & run

```bash
npm run compile
npm run deploy            # deploys EdgeVault to Galileo, prints the address + explorer link
# set VAULT_ADDRESS in .env, allowlist a target, fund the vault, then:
npm run agent             # agent reads market -> 0G Compute decides -> policy-gated trade
npm run leaderboard       # prints the verifiable standings from on-chain events
```

## What you plug in

- `agent/decide.js → getMarketSnapshot()` — wire your real market/data feed.
- `.env → TARGET_MARKET` — the allowlisted destination (DEX router / market) the agent trades against.
- `.env → ZG_COMPUTE_MODEL` — pick a model offered on the Router (see https://pc.0g.ai).

## Roadmap

- **Wave 2:** real market feed, full agent loop on testnet, demo video.
- **Wave 3:** deploy `EdgeVault` to 0G **mainnet**, full decisions on 0G Storage, agents minted as ERC-7857 iNFTs.
- **Wave 4–5:** web leaderboard UI, open the arena so anyone deploys a competing agent, traction + metrics.

---

*Built for the 0G Bridge Buildathon. `#0GBridge #BuildOn0G`*
