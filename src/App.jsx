import React, { useState } from 'react';
import Lobby from './components/Lobby';
import Profile from './components/Profile';

const styles = {
  app: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a1929 0%, #1a2942 50%, #0d2137 100%)',
    color: '#f5e6c8',
    fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif",
  },
  header: {
    padding: '20px 40px',
    borderBottom: '1px solid rgba(245, 230, 200, 0.15)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
    backgroundColor: 'rgba(10, 25, 41, 0.7)',
  },
  logo: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#f5e6c8',
    letterSpacing: '1px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  nav: {
    display: 'flex',
    gap: '15px',
  },
  navButton: {
    padding: '10px 22px',
    background: 'transparent',
    border: '1px solid rgba(245, 230, 200, 0.3)',
    color: '#f5e6c8',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  navButtonActive: {
    padding: '10px 22px',
    background: 'linear-gradient(135deg, #d4af37 0%, #f5e6c8 100%)',
    border: '1px solid #d4af37',
    color: '#0a1929',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '600',
    boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)',
  },
  main: {
    padding: '40px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
};

function App() {
  const [currentPage, setCurrentPage] = useState('lobby');

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div style={styles.logo}>
          <span>♞</span>
          <span>CRYPTO CHESS</span>
        </div>
        <nav style={styles.nav}>
          <button
            style={currentPage === 'lobby' ? styles.navButtonActive : styles.navButton}
            onClick={() => setCurrentPage('lobby')}
          >
            Лобби
          </button>
          <button
            style={currentPage === 'profile' ? styles.navButtonActive : styles.navButton}
            onClick={() => setCurrentPage('profile')}
          >
            Профиль
          </button>
        </nav>
      </header>

      <main style={styles.main}>
        {currentPage === 'lobby' && <Lobby />}
        {currentPage === 'profile' && <Profile />}
      </main>
    </div>
  );
}

export default App;