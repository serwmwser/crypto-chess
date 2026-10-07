import React from "react";
import { createRoot } from "react-dom/client";
import { createThirdwebClient } from "thirdweb";
import { ThirdwebProvider } from "thirdweb/react";
import App from "./App";
import "./i18n";
import "./styles.css";

const thirdwebClientId = import.meta.env.VITE_THIRDWEB_CLIENT_ID;
const thirdwebClient = thirdwebClientId
  ? createThirdwebClient({ clientId: thirdwebClientId })
  : null;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const scope = import.meta.env.BASE_URL;
    const workerUrl = new URL("sw.js", new URL(scope, window.location.origin));
    if (!import.meta.env.PROD) {
      navigator.serviceWorker
        .getRegistration(workerUrl.href)
        .then((registration) => registration?.unregister())
        .catch((error) => {
          console.warn("Could not unregister the development service worker:", error);
        });
      return;
    }

    navigator.serviceWorker.register(workerUrl, { scope }).catch((error) => {
      console.warn("Service worker registration failed:", error);
    });
  });
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThirdwebProvider client={thirdwebClient ?? undefined}>
      <App thirdwebClient={thirdwebClient} />
    </ThirdwebProvider>
  </React.StrictMode>
);
