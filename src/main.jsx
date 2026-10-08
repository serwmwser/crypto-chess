

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { ThirdwebProvider, createThirdwebClient } from "thirdweb";

// ⚠️ ЗАМЕНИ строку ниже на твой реальный Client ID из dashboard.thirdweb.com
const client = createThirdwebClient({
  clientId: "5a93d210fac8b6a2b7bc01bc4a873518", 
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThirdwebProvider client={client}>
      <App />
    </ThirdwebProvider>
  </React.StrictMode>
);