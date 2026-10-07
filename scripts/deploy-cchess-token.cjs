const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();

  // Укажите treasury-адрес, куда будет сразу зачислена вся эмиссия.
  // Если оставить пустым — эмиссия уйдёт на адрес деплоера.
  const treasury = process.env.CCHESS_TREASURY || deployer.address;

  const Token = await ethers.getContractFactory("CryptoChessToken");
  const token = await Token.deploy(treasury);

  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  const totalSupply = await token.totalSupply();

  console.log("\n=== Crypto Chess token deployment ===");
  console.log("Deployer:", deployer.address);
  console.log("Treasury:", treasury);
  console.log("Token address:", tokenAddress);
  console.log("Token symbol:", await token.symbol());
  console.log("Token name:", await token.name());
  console.log("Initial supply:", ethers.formatEther(totalSupply), "CCHESS");
  console.log("Treasury balance:", ethers.formatEther(await token.balanceOf(treasury)), "CCHESS");
  console.log("\nTo deploy on BNB Smart Chain run:");
  console.log("npx hardhat --config hardhat.config.cjs run scripts/deploy-cchess-token.cjs --network bsc");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
