const { ethers, network } = require("hardhat");

async function main() {
  const escrowAddress = process.env.VITE_ESCROW_ADDRESS || process.env.ESCROW_ADDRESS;
  if (!escrowAddress) throw new Error("Укажи VITE_ESCROW_ADDRESS в .env");
  const newWallet = process.env.NEW_FEE_RECIPIENT;
  if (!newWallet) throw new Error("Укажи NEW_FEE_RECIPIENT");

  const escrow = await ethers.getContractAt("ChessEscrow", escrowAddress);
  await (await escrow.setFeeRecipient(newWallet)).wait();
  console.log("✅ Кошелёк 5% теперь:", await escrow.feeRecipient(), "на", network.name);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });