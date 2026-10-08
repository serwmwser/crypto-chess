import { ethers } from 'ethers';
import { config } from './config';

// --- ABI ДЛЯ MOCK USDC (Упрощенный) ---
const MOCK_USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function faucet() external" // Функция для получения бесплатных токенов
];

// --- ABI ДЛЯ CHESS ESCROW (Твой контракт) ---
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

// Инициализация провайдера (соединение с блокчейном)
let provider = null;
let signer = null;

// Функция подключения кошелька
export const connectWallet = async () => {
  if (typeof window.ethereum !== 'undefined') {
    try {
      // Запрашиваем подключение
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      provider = new ethers.BrowserProvider(window.ethereum);
      signer = await provider.getSigner();
      
      // Проверяем сеть (должна быть 31337 для локалки)
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== config.network.chainId) {
        alert(`Ошибка сети! Нужна сеть ID ${config.network.chainId}, а у вас ${network.chainId}. Переключите сеть в MetaMask.`);
        return null;
      }
      
      return signer;
    } catch (error) {
      console.error("Ошибка подключения:", error);
      alert("Подключение отменено или ошибка.");
      return null;
    }
  } else {
    alert("MetaMask не установлен!");
    return null;
  }
};

// Получение экземпляра контракта USDC
export const getUSDCContract = async () => {
  if (!signer) await connectWallet();
  if (!signer) throw new Error("Кошелек не подключен");
  
  return new ethers.Contract(config.contracts.usdc, MOCK_USDC_ABI, signer);
};

// Получение экземпляра контракта ChessEscrow
export const getChessEscrowContract = async () => {
  if (!signer) await connectWallet();
  if (!signer) throw new Error("Кошелек не подключен");
  
  return new ethers.Contract(config.contracts.chessEscrow, CHESS_ESCROW_ABI, signer);
};

// Helper: Конвертация USDC (6 знаков после запятой)
export const parseUSDC = (amount) => {
  return ethers.parseUnits(amount.toString(), 6);
};

export const formatUSDC = (wei) => {
  return ethers.formatUnits(wei, 6);
};