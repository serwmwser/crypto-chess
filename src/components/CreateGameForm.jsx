import { useState } from 'react';
import { connectWallet, getUSDCContract, getChessEscrowContract, parseUSDC } from '../lib/contracts';

export default function CreateGameForm({ onGameCreated }) {
  const [stake, setStake] = useState('1'); // Ставка по умолчанию 1 USDC
  const [duration, setDuration] = useState(900); // 15 минут по умолчанию
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Функция получения бесплатных тестовых USDC
  const handleGetTokens = async () => {
    try {
      setLoading(true);
      setMessage('Подключение кошелька...');
      await connectWallet();
      
      setMessage('Вызов крана (faucet)...');
      const usdcContract = await getUSDCContract();
      const tx = await usdcContract.faucet();
      
      setMessage('Ожидание подтверждения транзакции...');
      await tx.wait();
      
      setMessage('✅ Получено 1000 тестовых USDC!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('❌ Ошибка при получении токенов: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Функция создания игры
  const handleCreateGame = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setMessage('Подключение кошелька...');
      await connectWallet();

      // Сначала нужно одобрить трату USDC контрактом игры
      setMessage('Одобрение расходов USDC...');
      const usdcContract = await getUSDCContract();
      const escrowAddress = (await getChessEscrowContract()).target;
      const amount = parseUSDC(stake);
      
      const approveTx = await usdcContract.approve(escrowAddress, amount);
      await approveTx.wait();

      // Теперь создаем игру
      setMessage('Создание игры в блокчейне...');
      const escrowContract = await getChessEscrowContract();
      const createTx = await escrowContract.createGame(amount, duration);
      
      setMessage('Ожидание подтверждения...');
      const receipt = await createTx.wait();
      
      // Извлекаем ID игры из события
      const event = receipt.logs.find(log => {
        try {
          const parsed = escrowContract.interface.parseLog(log);
          return parsed && parsed.name === 'GameCreated';
        } catch { return false; }
      });
      
      let gameId = null;
      if (event) {
        const parsed = escrowContract.interface.parseLog(event);
        gameId = parsed.args.id;
      }

      setMessage(`✅ Игра создана! ID: ${gameId}`);
      if (onGameCreated) onGameCreated(gameId);
      
      setTimeout(() => setMessage(''), 4000);
      
    } catch (err) {
      console.error(err);
      setMessage('❌ Ошибка: ' + (err.shortMessage || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
      <h2 className="text-xl font-bold text-white mb-4">Создать новую игру</h2>
      
      {/* Кнопка получения токенов */}
      <button 
        onClick={handleGetTokens}
        disabled={loading}
        className="w-full mb-4 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition disabled:opacity-50"
      >
        💰 Получить 1000 тестовых USDC
      </button>

      <form onSubmit={handleCreateGame} className="space-y-4">
        <div>
          <label className="block text-gray-400 text-sm mb-1">Ставка (USDC)</label>
          <input 
            type="number" 
            value={stake} 
            onChange={(e) => setStake(e.target.value)}
            min="0.1"
            step="0.1"
            className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-green-500"
            required
          />
        </div>

        <div>
          <label className="block text-gray-400 text-sm mb-1">Время (секунды)</label>
          <select 
            value={duration} 
            onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-green-500"
          >
            <option value={180}>3 минуты (Блиц)</option>
            <option value={300}>5 минут (Блиц)</option>
            <option value={900}>15 минут</option>
            <option value={1800}>30 минут</option>
            <option value={3600}>1 час</option>
          </select>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Обработка...' : '🚀 Создать игру'}
        </button>
      </form>

      {message && (
        <div className={`mt-4 p-3 rounded text-sm text-center ${message.includes('✅') ? 'bg-green-900 text-green-200' : message.includes('❌') ? 'bg-red-900 text-red-200' : 'bg-blue-900 text-blue-200'}`}>
          {message}
        </div>
      )}
    </div>
  );
}