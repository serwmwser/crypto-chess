export const config = {
  // Настройки для локальной сети Hardhat (сейчас мы работаем здесь)
  network: {
    chainId: 31337, 
    name: 'Hardhat Localhost',
    rpcUrl: 'http://127.0.0.1:8545'
  },
  
  // Адреса твоих задеплоенных контрактов
  contracts: {
    // Адрес MockUSDC (тестовый доллар)
    usdc: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    
    // Адрес ChessEscrow (игра со ставками)
    chessEscrow: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  }
};