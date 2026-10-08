export const config = {
  network: {
    chainId: 31337, 
    name: 'Hardhat Localhost',
    rpcUrl: 'http://127.0.0.1:8545'
  },
  contracts: {
    usdc: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    chessEscrow: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  }
};

// Все экспорты для совместимости с компонентами
export const ESCROW_ADDRESS = config.contracts.chessEscrow;
export const DURATIONS = { 180: '3 мин', 300: '5 мин', 900: '15 мин', 1800: '30 мин', 3600: '1 час' };
export const RELAY_URL = 'ws://localhost:3001';
export const FREE_TIME_CONTROLS = [180, 300, 900, 1800, 3600];
export const TOKEN_ADDRESS = config.contracts.usdc;
export const TOKEN_BUY_URL = 'https://faucet.polygon.technology/';
export const TOKEN_EXPLORER_URL = 'https://amoy.polygonscan.com/';
export const BNB_CHAIN_ID = 56;
export const CCHESS_EXCHANGE_ADDRESS = "0x0000000000000000000000000000000000000000";
export const CCHESS_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";