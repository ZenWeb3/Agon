require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/**
 * 0G Galileo Testnet (verified from docs.0g.ai):
 *   Chain ID:  16602
 *   RPC:       https://evmrpc-testnet.0g.ai   (development endpoint)
 *   Explorer:  https://chainscan-galileo.0g.ai
 *   Symbol:    0G
 */
module.exports = {
  solidity: "0.8.24",
  networks: {
    galileo: {
      url: process.env.RPC_URL || "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },
};
