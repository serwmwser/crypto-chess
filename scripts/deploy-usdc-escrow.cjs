const { ethers, network } = require("hardhat");

const POLYGON_USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

async function main() {
  const [deployer] = await ethers.getSigners();
  const feeRecipient = process.env.FEE_RECIPIENT;
  if (!feeRecipient) throw new Error("Укажи FEE_RECIPIENT в .env");
  const feeBps = process.env.FEE_BPS || "500";

  console.log("\n=== ChessEscrow (USDC) on", network.name, "===");
  console.log("Deployer:", deployer.address);
  console.log("Fee recipient (5%):", feeRecipient);

  let usdc = process.env.RESERVE_TOKEN_ADDRESS;
  if (network.name === "polygon") {
    usdc = usdc || POLYGON_USDC;
  } else {
    const Mock = await ethers.getContractFactory("MockUSDC");
    const mock = await Mock.deploy();
    await mock.waitForDeployment();
    usdc = await mock.getAddress();
    console.log("MockUSDC deployed:", usdc);
  }
  console.log("Game token (USDC):", usdc);

  const Escrow = await ethers.getContractFactory("ChessEscrow");
  const escrow = await Escrow.deploy(usdc, feeBps, feeRecipient);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();

  console.log("\n✅ ChessEscrow deployed:", escrowAddress);
  const tiers = await escrow.getStakeTiers();
  console.log("Ставок:", tiers.length, "(от 10¢ до $10)");

  console.log("\n📋 Вставь в .env фронтенда и в Vercel:");
  console.log(`VITE_CHAIN_ID=137`);
  console.log(`VITE_ESCROW_ADDRESS=${escrowAddress}`);
  console.log(`VITE_USDC_ADDRESS=${usdc}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});