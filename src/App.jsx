import React, { useState } from 'react';
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient, defineChain } from "thirdweb";
import { connectWallet, getUSDCContract } from './lib/contracts';
import { config } from './lib/config';

// Твой Client ID (оставь тот, который ты уже вставил!)
const client = createThirdwebClient({
  clientId: "ТВОЙ_РЕАЛЬНЫЙ_CLIENT_ID", 
});

const chain = defineChain({
  id: config.network.chainId,
  name: config.network.name,
});

function App() {
  const account = useActiveAccount();
  const [message, setMessage] = useState('');
  const [balance, setBalance] = useState('0');

  // Функция получения тестовых токенов (Faucet)
  const handleGetTokens = async () => {
    setMessage(' Запрос токенов... Подтвердите транзакцию в MetaMask.');
    try {
      // Подключаемся через ethers (наш старый проверенный метод)
      const signer = await connectWallet();
      if (!signer) throw new Error("Кошелек не подключен");
      
      const tokenContract = await getUSDCContract();
      
      // Вызываем функцию faucet() из смарт-контракта
      const tx = await tokenContract.faucet();
      await tx.wait();
      
      setMessage('✅ Успех! 1000 тестовых USDC зачислены на ваш баланс.');
      setBalance('1000');
    } catch (err) {
      console.error(err);
      setMessage('❌ Ошибка: ' + (err.reason || err.message || 'Транзакция отменена'));
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: '#2c3e50', fontSize: '36px' }}>♟️ Crypto Chess</h1>
      <p style={{ color: '#27ae60', fontWeight: 'bold' }}>✅ Инфраструктура настроена успешно!</p>

      {!account ? (
        <div style={{ marginTop: '40px', padding: '40px', border: '2px dashed #3498db', borderRadius: '12px', backgroundColor: '#f8f9fa' }}>
          <h3>Шаг 1: Подключите кошелек</h3>
          <p>Нажмите кнопку ниже, чтобы подключить MetaMask.</p>
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
            <ConnectButton client={client} chain={chain} />
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '40px' }}>
          <p>Подключено: <strong>{account.address.slice(0,6)}...{account.address.slice(-4)}</strong></p>
          
          <div style={{ padding: '30px', border: '2px solid #27ae60', borderRadius: '12px', backgroundColor: '#e8f8f5' }}>
            <h3>Шаг 2: Получите тестовые токены</h3>
            <p>Текущий баланс: <strong>{balance} USDC</strong></p>
            <p style={{ fontSize: '14px', color: '#7f8c8d' }}>
              (Токены работают в сети Hardhat Local ID 31337. Убедитесь, что MetaMask переключен на эту сеть).
            </p>
            <button 
              onClick={handleGetTokens} 
              style={{ marginTop: '20px', padding: '12px 24px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '8px' }}
            >
              Получить 1000 тестовых USDC
            </button>
          </div>

          {message && (
            <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#fff3cd', borderRadius: '8px', fontWeight: 'bold' }}>
              {message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;