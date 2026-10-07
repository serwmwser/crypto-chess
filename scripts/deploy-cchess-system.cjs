const { ethers, network } = require("hardhat");

const DEFAULT_GROK = "0x62a3e247e28cad2d2902cd2dc2e6aea7cdd14444";

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

  const treasury = process.env.CCHESS_TREASURY || deployer.address;
  const grokAddress = await resolveGrokAddress(process.env.GROK_TOKEN_ADDRESS || DEFAULT_GROK);
  const shouldAutoTransfer = (process.env.AUTO_TRANSFER_TO_EXCHANGE || "false").toLowerCase() === "true";
  const inventoryAmount = process.env.CCHESS_EXCHANGE_INVENTORY || "1000000";

  console.log("\n=== Deploying Crypto Chess token system ===");
  console.log("Deployer:", deployer.address);
  console.log("Treasury:", treasury);
  console.log("GROK token:", grokAddress);

  const Token = await ethers.getContractFactory("CryptoChessToken");
  const token = await Token.deploy(treasury);
  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();

  const Exchange = await ethers.getContractFactory("CryptoChessExchange");
  const exchange = await Exchange.deploy(grokAddress, tokenAddress);
  await exchange.waitForDeployment();

  const exchangeAddress = await exchange.getAddress();
  const totalSupply = await token.totalSupply();

  console.log("\nToken deployed:", tokenAddress);
  console.log("Exchange deployed:", exchangeAddress);
  console.log("Total supply:", ethers.formatEther(totalSupply), "CCHESS");
  console.log("Treasury balance:", ethers.formatEther(await token.balanceOf(treasury)), "CCHESS");

  if (shouldAutoTransfer) {
    const amount = ethers.parseEther(inventoryAmount);
    const tx = await token.transfer(exchangeAddress, amount);
    await tx.wait();
    console.log("\nTransferred to exchange:", ethers.formatEther(amount), "CCHESS");
    console.log("Exchange inventory:", ethers.formatEther(await exchange.gameTokenInventory()), "CCHESS");
  } else {
    console.log("\nNext step: transfer CCHESS inventory to the exchange contract from the treasury wallet.");
    console.log("Example:");
    console.log(`token.transfer("${exchangeAddress}", ethers.parseEther("1000000"))`);
  }

  console.log("\nAdd to .env:");
  console.log(`VITE_CCHESS_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`VITE_CCHESS_EXCHANGE_ADDRESS=${exchangeAddress}`);
  console.log(`VITE_GROK_TOKEN_ADDRESS=${grokAddress}`);
  console.log(`VITE_ESCROW_ADDRESS=0x...`);
  console.log("\nImportant: after deployment, in the app profile you must have GROK balance in the user's wallet for buy() to work.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
