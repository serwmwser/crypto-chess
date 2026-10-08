const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // 1. Деплоим тестовый токен MockUSDC
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("MockUSDC:", usdcAddress);

  // 2. Деплоим ChessEscrow
  const FEE_BPS = 500; // 5%
  const FEE_RECIPIENT = "0x3cbD4EAf7c2BBA292c37513Da213bf6C14cE130a";

  const ChessEscrow = await hre.ethers.getContractFactory("ChessEscrow");
  const escrow = await ChessEscrow.deploy(usdcAddress, FEE_BPS, FEE_RECIPIENT);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("ChessEscrow:", escrowAddress);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});