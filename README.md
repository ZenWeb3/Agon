# Agon

**Autonomous AI trading agents that run verifiably on 0G — every decision attested in a TEE, every trade gated by on-chain policy, every result on a provable leaderboard.**

> Live on 0G Galileo testnet · EdgeVault: [`0xf2240C55A804De3839A42bCB371af7feA172eF60`](https://chainscan-galileo.0g.ai/address/0xf2240C55A804De3839A42bCB371af7feA172eF60)

---

## The problem

AI agents are being handed money, but you can't actually trust them: they hallucinate, they get prompt-injected, and they run as black boxes you have to take on faith. That's the real blocker to agent autonomy — not capability, but trust.

Proof of Edge makes an autonomous trading agent you *can* trust. Its decision is cryptographically proven to be the authorized model running in a TEE (via 0G Compute), and its spending is physically capped on-chain, so even a compromised agent can never exceed what you authorized. Don't trust the agent — verify it.

## What it does

- An agent reads a market snapshot and decides a position using a model on **0G Compute**.
- The on-chain **EdgeVault** contract enforces six spending policies before any trade executes.
- Every inference returns a **TEE attestation** (`tee_verified: true`) naming the provider that ran it.
- Every trade and outcome is an on-chain event, aggregated into a **verifiable leaderboard** anyone can recompute.

## 0G components used

| Component | How it's used |
|-----------|---------------|
| **0G Chain** | `EdgeVault` enforces the six policies and emits the `TradeExecuted` / `OutcomeRecorded` events behind the leaderboard. |
| **0G Compute** | The agent's decision runs on the Compute Router with `verify_tee: true`, returning a TEE attestation of the inference. |
| **0G Storage** *(roadmap)* | Persist the full decision + attestation, referenced on-chain by `decisionRef`. |
| **ERC-7857 (Agentic ID)** *(roadmap)* | Mint each competing agent as an iNFT; encode its policy as the `authorizeUsage` scope. |

## Verifiable inference (the core)

Each decision calls 0G Compute with `verify_tee: true` and receives an attestation in the response trace:

```json
"x_0g_trace": {
  "provider": "0xa48f01287233509FD694a22Bf840225062E67836",
  "request_id": "69ad5a92-f1ee-4913-af58-6fbde6207ab3",
  "tee_verified": true
}
```

So "the agent decided BUY" is provably the authorized model running inside a TEE — not our server's word for it. In production the agent refuses to trade unless `tee_verified === true`.

## The six enforced policies

Every `executeTrade` call is checked on-chain before a single transfer:

1. Caller is the authorized agent
2. Target is on the allowlist
3. Trade size ≤ `maxPerTrade`
4. Rolling-window spend ≤ `spendCap`
5. Cooldown since last trade has elapsed
6. Vault holds sufficient balance

All six are covered by a 10-test suite (`npx hardhat test test/EdgeVault.test.cjs` → **10 passing**).

## Architecture

```
market snapshot ─► agent/decide.js ─► 0G Compute Router (verify_tee → TEE attestation)
                                            │
                                            ▼
                                EdgeVault.executeTrade()  ── 6 policy checks ──► transfer
                                            │ emits events
                                            ▼
                            leaderboard/read.js ─► provable standings
```

## Run it

```bash
npm install
cp .env.example .env        # add a throwaway testnet key, VAULT_ADDRESS, TARGET_MARKET, 0G Compute key
npm run compile
npx hardhat test test/EdgeVault.test.cjs     # 10 passing
npm run deploy                               # deploy EdgeVault to Galileo
npx hardhat run scripts/configure.cjs --network galileo   # fund + allowlist
npm run agent                                # decide on 0G Compute → policy-gated trade
npm run leaderboard                          # verifiable standings
```

Network: 0G Galileo Testnet · Chain ID **16602** · RPC `https://16602.rpc.thirdweb.com` · Symbol `0G` · Faucet https://faucet.0g.ai

## Roadmap

- **Wave 2:** real market feed, full demo, recorded walkthrough.
- **Wave 3:** deploy to 0G **mainnet**, full decisions on 0G **Storage**, agents minted as **ERC-7857** iNFTs.
- **Wave 4–5:** web leaderboard UI, open the arena so anyone deploys a competing agent, real traction + metrics.

---

*Built for the 0G Bridge Buildathon.* `#0GBridge #BuildOn0G` · `@0G_labs @0G_Builders @AKINDO_io`