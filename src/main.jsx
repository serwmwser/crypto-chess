import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { createThirdwebClient } from "thirdweb";
import { ThirdwebProvider } from "thirdweb/react";

const client = createThirdwebClient({
  clientId: "fc1b95eb7453e110e8e2007b00301f0e", 
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThirdwebProvider client={client}>
      <App />
    </ThirdwebProvider>
  </React.StrictMode>
);
