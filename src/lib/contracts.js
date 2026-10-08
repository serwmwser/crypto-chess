import { ethers } from 'ethers';
import { config } from './config';

const MOCK_USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function faucet() external"
];

const CHESS_ESCROW_ABI = [
  "function createGame(uint256 stake, uint32 duration) external returns (uint256)",
  "function joinGame(uint256 id, uint256 stake) external",
  "function cancelGame(uint256 id) external",
  "function resign(uint256 id) external",
  "function agreeDraw(uint256 id) external",
  "function totalGames() view returns (uint256)",
  "function games(uint256) view returns (address creator, address challenger, uint256 stakeCreator, uint256 stakeChallenger, uint32 createdAt, uint32 startedAt, uint32 duration, uint8 status, address winner, bool creatorDraw, bool challengerDraw)",
  "function allowedStakes(uint256) view returns (bool)",
  "function getStakeTiers() view returns (uint256[])"
];

let provider = null;
let signer = null;

export const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export const connectWallet = async () => {
  if (typeof window.ethereum !== 'undefined') {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== config.network.chainId) {
        alert(`Ошибка сети! Нужна сеть ID ${config.network.chainId}, а у вас ${network.chainId}.`);
        return null;
      }
      return signer;
    } catch (error) {
      console.error("Ошибка подключения:", error);
      return null;
    }
  } else {
    alert("MetaMask не установлен!");
    return null;
  }
};

export const getUSDCContract = async () => {
  if (!signer) await connectWallet();
  if (!signer) throw new Error("Кошелек не подключен");
  return new ethers.Contract(config.contracts.usdc, MOCK_USDC_ABI, signer);
};

export const getChessEscrowContract = async () => {
  if (!signer) await connectWallet();
  if (!signer) throw new Error("Кошелек не подключен");
  return new ethers.Contract(config.contracts.chessEscrow, CHESS_ESCROW_ABI, signer);
};

export const getEscrow = async () => getChessEscrowContract();
export const getEscrowView = async () => {
  if (!provider) await connectWallet();
  return new ethers.Contract(config.contracts.chessEscrow, CHESS_ESCROW_ABI, provider);
};
export const getEscrowToken = async () => getUSDCContract();
export const getToken = async () => getUSDCContract();
export const getGameToken = async () => getUSDCContract();

export const parseUSDC = (amount) => ethers.parseUnits(amount.toString(), 6);
export const formatUSDC = (wei) => ethers.formatUnits(wei, 6);
export const formatStake = (wei) => formatUSDC(wei);
export const shortAddr = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

export const fetchGames = async () => { try { return []; } catch (e) { return []; } };
export const escrowReady = async () => true;
export const parseGame = (gameData) => gameData || {};