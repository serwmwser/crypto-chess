import { Contract } from "ethers";
import {
  CCHESS_EXCHANGE_ADDRESS,
  CCHESS_TOKEN_ADDRESS,
  ESCROW_ADDRESS,
  TOKEN_ADDRESS,
} from "./config";

export const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export const TOKEN_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function transfer(address to, uint256 value) returns (bool)",
];

export const CCHESS_TOKEN_ABI = [...TOKEN_ABI];

export const CCHESS_EXCHANGE_ABI = [
  "function buy(uint256 amount)",
  "function sell(uint256 amount)",
  "function grokReserve() view returns (uint256)",
  "function gameTokenInventory() view returns (uint256)",
];

export const ESCROW_ABI = [
  "function token() view returns (address)",
  "function feeBps() view returns (uint16)",
  "function feeRecipient() view returns (address)",
  "function minStake() view returns (uint256)",
  "function gameCount() view returns (uint256)",
  "function getGame(uint256) view returns (address creator, address challenger, uint256 stakeCreator, uint256 stakeChallenger, uint32 startedAt, uint32 duration, uint8 status, address winner, bool creatorDraw, bool challengerDraw)",
  "function createGame(uint256 stake, uint32 duration)",
  "function joinGame(uint256 id, uint256 stake)",
  "function cancelGame(uint256 id)",
  "function resign(uint256 id)",
  "function agreeDraw(uint256 id)",
  "event GameCreated(uint256 indexed id, address indexed creator, uint256 stake, uint32 duration)",
  "event GameJoined(uint256 indexed id, address indexed challenger, uint256 stake, uint32 startedAt)",
  "event GameCancelled(uint256 indexed id)",
  "event Resigned(uint256 indexed id, address indexed resigner, address indexed winner)",
  "event DrawSettled(uint256 indexed id, uint256 payoutEach)",
];

export const escrowReady = () =>
  ESCROW_ADDRESS && ESCROW_ADDRESS !== ZERO_ADDR;

export const cchessReady = () =>
  CCHESS_TOKEN_ADDRESS &&
  CCHESS_TOKEN_ADDRESS !== ZERO_ADDR &&
  CCHESS_EXCHANGE_ADDRESS &&
  CCHESS_EXCHANGE_ADDRESS !== ZERO_ADDR;

export const getToken = (provider) => new Contract(TOKEN_ADDRESS, TOKEN_ABI, provider);
export const getGameToken = (provider) =>
  new Contract(CCHESS_TOKEN_ADDRESS, CCHESS_TOKEN_ABI, provider);
export const getCChessExchange = (signer) =>
  new Contract(CCHESS_EXCHANGE_ADDRESS, CCHESS_EXCHANGE_ABI, signer);
export const getCChessExchangeView = (provider) =>
  new Contract(CCHESS_EXCHANGE_ADDRESS, CCHESS_EXCHANGE_ABI, provider);

export const getEscrow = (signer) =>
  new Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);

export const getEscrowView = (provider) =>
  new Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);

export async function getEscrowToken(provider) {
  const tokenAddress = await getEscrowView(provider).token();
  return new Contract(tokenAddress, TOKEN_ABI, provider);
}

// Преобразует результат getGame в плоский объект
export const parseGame = (g) => ({
  creator: g.creator,
  challenger: g.challenger,
  stakeCreator: g.stakeCreator.toString(),
  stakeChallenger: g.stakeChallenger.toString(),
  startedAt: Number(g.startedAt),
  duration: Number(g.duration),
  status: Number(g.status),
  winner: g.winner,
  creatorDraw: g.creatorDraw,
  challengerDraw: g.challengerDraw,
});

// Читает последние N игр (для лобби/профиля)
export async function fetchGames(provider, limit = 60) {
  const view = getEscrowView(provider);
  const count = Number(await view.gameCount());
  const from = Math.max(0, count - limit);
  const ids = [];
  for (let i = from; i < count; i++) ids.push(i);
  const games = await Promise.all(ids.map((i) => view.getGame(i)));
  return games.map((g, i) => ({ id: ids[i], ...parseGame(g) }));
}

export const shortAddr = (a) =>
  a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";

export const formatStake = (raw, decimals) =>
  Number((BigInt(raw) / 10n ** BigInt(decimals)).toString()).toLocaleString("en-US");
