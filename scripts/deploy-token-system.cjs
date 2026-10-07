const { ethers, network } = require("hardhat");

const DEFAULT_GROK = "0x62a3e247e28cad2d2902cd2dc2e6aea7cdd14444";
const DEFAULT_TREASURY = "0xc2e5650f84Eeb9e4011afbb398108ea302cB17A6";

async function resolveGrokAddress(candidateAddress) {
  if (network.name !== "hardhat" && network.name !== "localhost") {
    return candidateAddress;
  }

  if (candidateAddress && candidateAddress !== DEFAULT_GROK) {
    return candidateAddress;
  }

  const MockGrok = await ethers.getContractFactory("MockGrok");
  const mockGrok = await MockGrok.deploy();
  await mockGrok.waitForDeployment();
  const address = await mockGrok.getAddress();
  console.log(`Hardhat network detected. Local mock GROK deployed at: ${address}`);
  return address;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const treasury = process.env.CCHESS_TREASURY_ADDRESS || DEFAULT_TREASURY;
  const grokAddress = await resolveGrokAddress(process.env.GROK_TOKEN_ADDRESS || DEFAULT_GROK);
  const feeRecipient = process.env.FEE_RECIPIENT_ADDRESS || treasury;

  const Token = await ethers.getContractFactory("CryptoChessToken");
  const token = await Token.deploy(treasury);
  await token.waitForDeployment();

  const Exchange = await ethers.getContractFactory("CryptoChessExchange");
  const exchange = await Exchange.deploy(grokAddress, await token.getAddress());
  await exchange.waitForDeployment();

  const Escrow = await ethers.getContractFactory("ChessEscrow");
  const escrow = await Escrow.deploy(await token.getAddress(), 500, feeRecipient);
  await escrow.waitForDeployment();

  console.log(`Deployer: ${deployer.address}`);
  console.log(`CCHESS token: ${await token.getAddress()}`);
  console.log(`GROK/CCHESS exchange: ${await exchange.getAddress()}`);
  console.log(`CCHESS ChessEscrow: ${await escrow.getAddress()}`);
  console.log(`Treasury initial CCHESS balance: ${ethers.formatEther(await token.balanceOf(treasury))}`);
  console.log("Next: from the treasury wallet, transfer the desired CCHESS inventory to the exchange contract.");
  console.log("No initial GROK reserve is required. GROK accumulates as players buy CCHESS.");
  console.log("Configure VITE_CCHESS_TOKEN_ADDRESS, VITE_CCHESS_EXCHANGE_ADDRESS, VITE_ESCROW_ADDRESS, and VITE_GROK_TOKEN_ADDRESS after reviewing and deploying.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});