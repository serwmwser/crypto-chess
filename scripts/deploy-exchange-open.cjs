const { ethers } = require("hardhat");

async function main() {
  const grok = process.env.GROK_TOKEN_ADDRESS;
  const cchess = process.env.CCHESS_TOKEN_ADDRESS;

  if (!grok || !cchess) {
    throw new Error("Set GROK_TOKEN_ADDRESS and CCHESS_TOKEN_ADDRESS before deploying the exchange");
  }

  const Exchange = await ethers.getContractFactory("CryptoChessExchangeOpen");
  const exchange = await Exchange.deploy(grok, cchess);
  await exchange.waitForDeployment();

  console.log("Exchange deployed:", await exchange.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
