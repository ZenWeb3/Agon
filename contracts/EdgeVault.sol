// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EdgeVault
 * @notice Policy-gated vault for an autonomous trading agent on 0G Chain.
 *
 * The agent can only move funds through `executeTrade`, and every call is
 * checked against SIX enforced policies before a single transfer happens:
 *   1. Caller must be the authorized agent (agent-gating)
 *   2. Target must be on the allowlist (where it's allowed to send)
 *   3. Per-trade size must be <= maxPerTrade (single-trade cap)
 *   4. Rolling window spend must stay <= spendCap (budget cap)
 *   5. Cooldown since the last trade must have elapsed (rate limit)
 *   6. Vault must hold enough balance (no overdraft)
 *
 * Decisions come from the agent reasoning on 0G Compute; this contract is the
 * on-chain enforcement layer that makes those decisions safe and auditable.
 * Every trade and outcome is emitted as an event for the public leaderboard.
 */
contract EdgeVault {
    address public owner;       // human principal who funds and configures the vault
    address public agent;       // the autonomous agent authorized to trade

    uint256 public spendCap;    // max total spend allowed per rolling window (wei)
    uint256 public maxPerTrade; // max size of any single trade (wei)
    uint256 public window;      // length of the rolling spend window (seconds)
    uint256 public cooldown;    // minimum seconds between trades

    uint256 public windowStart;     // timestamp the current window began
    uint256 public spentInWindow;   // amount spent so far in the current window
    uint256 public lastTradeTime;   // timestamp of the most recent trade
    uint256 public tradeCount;      // monotonic trade id counter

    mapping(address => bool) public allowed; // allowlisted trade targets

    event AgentUpdated(address indexed agent);
    event AllowlistUpdated(address indexed target, bool allowed);
    event Deposited(address indexed from, uint256 amount);
    event TradeExecuted(
        uint256 indexed tradeId,
        address indexed agent,
        address indexed target,
        uint256 amount,
        bytes32 decisionRef, // hash/ref of the 0G Compute decision that authorized this
        uint256 timestamp
    );
    event OutcomeRecorded(uint256 indexed tradeId, int256 pnl, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == agent, "not agent");
        _;
    }

    constructor(
        address _agent,
        uint256 _spendCap,
        uint256 _maxPerTrade,
        uint256 _window,
        uint256 _cooldown
    ) {
        owner = msg.sender;
        agent = _agent;
        spendCap = _spendCap;
        maxPerTrade = _maxPerTrade;
        window = _window;
        cooldown = _cooldown;
        windowStart = block.timestamp;
        emit AgentUpdated(_agent);
    }

    // --- configuration (owner only) ---

    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
        emit AgentUpdated(_agent);
    }

    function setAllowed(address target, bool ok) external onlyOwner {
        allowed[target] = ok;
        emit AllowlistUpdated(target, ok);
    }

    function setPolicies(
        uint256 _spendCap,
        uint256 _maxPerTrade,
        uint256 _window,
        uint256 _cooldown
    ) external onlyOwner {
        spendCap = _spendCap;
        maxPerTrade = _maxPerTrade;
        window = _window;
        cooldown = _cooldown;
    }

    // --- funding ---

    function deposit() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }

    // --- the policy-gated action the agent calls ---

    /**
     * @param target       allowlisted destination (e.g. a DEX router / market)
     * @param amount       amount to move (wei)
     * @param decisionRef  hash/reference of the 0G Compute decision authorizing this
     * @param payload      optional calldata forwarded to the target (e.g. a swap)
     */
    function executeTrade(
        address target,
        uint256 amount,
        bytes32 decisionRef,
        bytes calldata payload
    ) external onlyAgent returns (uint256 tradeId) {
        // 2. allowlist
        require(allowed[target], "target not allowed");
        // 3. single-trade cap
        require(amount <= maxPerTrade, "exceeds max per trade");
        // 5. cooldown
        require(block.timestamp >= lastTradeTime + cooldown, "cooldown active");
        // 6. balance
        require(address(this).balance >= amount, "insufficient balance");

        // 4. rolling-window budget (reset window if elapsed)
        if (block.timestamp >= windowStart + window) {
            windowStart = block.timestamp;
            spentInWindow = 0;
        }
        require(spentInWindow + amount <= spendCap, "exceeds window spend cap");

        // effects
        spentInWindow += amount;
        lastTradeTime = block.timestamp;
        tradeId = ++tradeCount;

        // interaction
        (bool ok, ) = target.call{value: amount}(payload);
        require(ok, "trade call failed");

        emit TradeExecuted(tradeId, agent, target, amount, decisionRef, block.timestamp);
    }

    /**
     * @notice Record the realized P&L of a trade so the leaderboard can score it.
     * @dev In production this comes from a settlement oracle; for the MVP the owner posts it.
     */
    function recordOutcome(uint256 tradeId, int256 pnl) external onlyOwner {
        require(tradeId <= tradeCount && tradeId > 0, "bad tradeId");
        emit OutcomeRecorded(tradeId, pnl, block.timestamp);
    }

    // --- views ---

    function remainingWindowBudget() external view returns (uint256) {
        if (block.timestamp >= windowStart + window) return spendCap;
        if (spentInWindow >= spendCap) return 0;
        return spendCap - spentInWindow;
    }

    function secondsUntilNextTrade() external view returns (uint256) {
        uint256 ready = lastTradeTime + cooldown;
        if (block.timestamp >= ready) return 0;
        return ready - block.timestamp;
    }

    function withdraw(uint256 amount) external onlyOwner {
        (bool ok, ) = owner.call{value: amount}("");
        require(ok, "withdraw failed");
    }
}
