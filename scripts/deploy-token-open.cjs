const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const treasury = process.env.CCHESS_TREASURY || deployer.address;

  const Token = await ethers.getContractFactory("CryptoChessTokenOpen");
  const token = await Token.deploy(treasury);
  await token.waitForDeployment();

  console.log("Token deployed:", await token.getAddress());
  console.log("Name:", await token.name());
  console.log("Symbol:", await token.symbol());
  console.log("Total supply:", ethers.formatEther(await token.totalSupply()));
  console.log("Treasury balance:", ethers.formatEther(await token.balanceOf(treasury)));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
