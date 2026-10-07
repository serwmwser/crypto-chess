const { ethers } = require("hardhat");

async function main() {
  const tokenAddress = process.env.CCHESS_TOKEN_ADDRESS || "0x2370413909571bA45f77A536A4CaA18a7112C8EE";
  const exchangeAddress = process.env.CCHESS_EXCHANGE_ADDRESS || "0xc25E472bBfC1512470C4ab34546cf6F5D8b143b7";
  const amount = process.env.CCHESS_TRANSFER_AMOUNT || "1000000";

  const [deployer] = await ethers.getSigners();

  const token = await ethers.getContractAt("CryptoChessToken", tokenAddress);
  const decimals = await token.decimals();
  const value = ethers.parseUnits(amount, decimals);

  const tx = await token.transfer(exchangeAddress, value);
  await tx.wait();

  console.log("\n=== CCHESS transfer to exchange ===");
  console.log("From:", deployer.address);
  console.log("Token:", tokenAddress);
  console.log("Exchange:", exchangeAddress);
  console.log("Amount:", amount, "CCHESS");
  console.log("Tx:", tx.hash);
  console.log("Exchange inventory:", ethers.formatUnits(await token.balanceOf(exchangeAddress), decimals), "CCHESS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
