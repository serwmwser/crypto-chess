import React from 'react';
import { ConnectButton } from "thirdweb/react";
import { defineChain } from "thirdweb";

// Определяем сеть (Hardhat Local для тестов)
const chain = defineChain({
  id: 31337,
  name: "Hardhat Local",
});

function App() {
  return (
    <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: '#2c3e50', fontSize: '36px' }}>♟️ Crypto Chess</h1>
      <p style={{ fontSize: '20px', color: '#27ae60', fontWeight: 'bold' }}>✅ САЙТ РАБОТАЕТ И ЗАГРУЖЕН!</p>
      
      <div style={{ marginTop: '40px', padding: '30px', border: '2px dashed #3498db', borderRadius: '12px', backgroundColor: '#f8f9fa' }}>
        <h3>Шаг 1: Подключите кошелек</h3>
        <p>Нажмите кнопку ниже, чтобы подключить MetaMask и получить тестовые токены.</p>
        
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
          <ConnectButton 
            client={{ clientId: "fc1b95eb7453e110e8e2007b00301f0e" }}
            chain={chain}
            style={{ fontSize: '16px', padding: '12px 24px', borderRadius: '8px' }}
          />
        </div>
      </div>

      <div style={{ marginTop: '40px', color: '#7f8c8d', fontSize: '14px' }}>
        <p>Инфраструктура настроена успешно. Готовы к добавлению игровой логики.</p>
      </div>
    </div>
  );
}

export default App;