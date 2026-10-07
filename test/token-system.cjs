const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CryptoChess token system", function () {
  let treasury;
  let alice;
  let bob;
  let grok;
  let gameToken;
  let exchange;
  let escrow;

  const unit = ethers.parseEther;

  beforeEach(async function () {
    [, treasury, alice, bob] = await ethers.getSigners();

    const MockGrok = await ethers.getContractFactory("MockGrok");
    grok = await MockGrok.deploy();

    const CryptoChessToken = await ethers.getContractFactory("CryptoChessToken");
    gameToken = await CryptoChessToken.deploy(treasury.address);

    const CryptoChessExchange = await ethers.getContractFactory("CryptoChessExchange");
    exchange = await CryptoChessExchange.deploy(grok, gameToken);

    const ChessEscrow = await ethers.getContractFactory("ChessEscrow");
    escrow = await ChessEscrow.deploy(gameToken, 500, treasury.address);
  });

  it("mints exactly one billion CCHESS to the configured treasury", async function () {
    expect(await gameToken.totalSupply()).to.equal(unit("1000000000"));
    expect(await gameToken.balanceOf(treasury.address)).to.equal(unit("1000000000"));
  });

  it("buys CCHESS 1:1 and keeps deposited GROK as the reserve", async function () {
    const amount = unit("250");
    await gameToken.connect(treasury).transfer(exchange, amount);
    await grok.transfer(alice, amount);
    await grok.connect(alice).approve(exchange, amount);

    await expect(exchange.connect(alice).buy(amount))
      .to.emit(exchange, "Bought")
      .withArgs(alice.address, amount);

    expect(await gameToken.balanceOf(alice.address)).to.equal(amount);
    expect(await exchange.grokReserve()).to.equal(amount);
    expect(await exchange.gameTokenInventory()).to.equal(0);
  });

  it("burns CCHESS and redeems the same amount of GROK", async function () {
    const amount = unit("100");
    await gameToken.connect(treasury).transfer(exchange, amount);
    await grok.transfer(alice, amount);
    await grok.connect(alice).approve(exchange, amount);
    await exchange.connect(alice).buy(amount);
    await gameToken.connect(alice).approve(exchange, amount);

    await expect(exchange.connect(alice).sell(amount))
      .to.emit(exchange, "Sold")
      .withArgs(alice.address, amount);

    expect(await grok.balanceOf(alice.address)).to.equal(amount);
    expect(await gameToken.balanceOf(alice.address)).to.equal(0);
    expect(await gameToken.totalSupply()).to.equal(unit("1000000000") - amount);
    expect(await exchange.grokReserve()).to.equal(0);
  });

  it("does not sell CCHESS before GROK has entered the reserve", async function () {
    const amount = unit("10");
    await gameToken.connect(treasury).transfer(alice, amount);
    await gameToken.connect(alice).approve(exchange, amount);

    await expect(exchange.connect(alice).sell(amount))
      .to.be.revertedWithCustomError(exchange, "InsufficientGrokReserve");
    expect(await gameToken.balanceOf(alice.address)).to.equal(amount);
  });

  it("uses CCHESS for createGame, joinGame, resign, and payout", async function () {
    const stake = unit("50000");
    await gameToken.connect(treasury).transfer(alice, stake);
    await gameToken.connect(treasury).transfer(bob, stake);
    await gameToken.connect(alice).approve(escrow, stake);
    await gameToken.connect(bob).approve(escrow, stake);

    await escrow.connect(alice).createGame(stake, 900);
    await escrow.connect(bob).joinGame(0, stake);
    await escrow.connect(alice).resign(0);

    const game = await escrow.getGame(0);
    expect(game.status).to.equal(2);
    expect(game.winner).to.equal(bob.address);
    expect(await gameToken.balanceOf(bob.address)).to.equal(unit("95000"));
  });

  it("releases the escrowed CCHESS when both players agree to a draw", async function () {
    const stake = unit("50000");
    await gameToken.connect(treasury).transfer(alice, stake);
    await gameToken.connect(treasury).transfer(bob, stake);
    await gameToken.connect(alice).approve(escrow, stake);
    await gameToken.connect(bob).approve(escrow, stake);
    await escrow.connect(alice).createGame(stake, 900);
    await escrow.connect(bob).joinGame(0, stake);

    await escrow.connect(alice).agreeDraw(0);
    await escrow.connect(bob).agreeDraw(0);

    const game = await escrow.getGame(0);
    expect(game.status).to.equal(3);
    expect(await gameToken.balanceOf(alice.address)).to.equal(stake);
    expect(await gameToken.balanceOf(bob.address)).to.equal(stake);
  });
});