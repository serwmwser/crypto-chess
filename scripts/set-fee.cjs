const { ethers, network } = require("hardhat");

async function main() {
  const escrowAddress = process.env.VITE_ESCROW_ADDRESS || process.env.ESCROW_ADDRESS;
  if (!escrowAddress) throw new Error("Укажи VITE_ESCROW_ADDRESS в .env");
  const newFee = process.env.NEW_FEE_BPS || "500";

  const escrow = await ethers.getContractAt("ChessEscrow", escrowAddress);
  console.log("Старая комиссия:", (await escrow.feeBps()).toString());
  await (await escrow.setFeeBps(newFee)).wait();
  console.log("✅ Новая комиссия:", (await escrow.feeBps()).toString(), "на", network.name);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });