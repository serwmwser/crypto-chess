import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { formatUnits } from "ethers";
import { useTranslation } from "react-i18next";
import {
  useActiveAccount,
  useActiveWallet,
  useActiveWalletConnectionStatus,
  useDisconnect,
} from "thirdweb/react";
import { ethers6Adapter } from "thirdweb/adapters/ethers6";
import { bsc } from "thirdweb/chains";
import Header from "./components/Header";
import Profile from "./components/Profile";
import Lobby from "./components/Lobby";
import GameRoom from "./components/GameRoom";
import FreeGameRoom from "./components/FreeGameRoom";
import { BNB_CHAIN_ID, FREE_TIME_CONTROLS } from "./lib/config";
import { getToken } from "./lib/contracts";
import { readFreeGames, removeFreeGame, saveFreeGame } from "./lib/freeGames";

export default function App({ thirdwebClient }) {
  const { t, i18n } = useTranslation();
  const activeAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
  const walletConnectionStatus = useActiveWalletConnectionStatus();
  const { disconnect } = useDisconnect();
  const readProvider = useMemo(
    () => thirdwebClient
      ? ethers6Adapter.provider.toEthers({ client: thirdwebClient, chain: bsc })
      : null,
    [thirdwebClient]
  );
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [decimals, setDecimals] = useState(18);
  const [balance, setBalance] = useState("0");
  const [rpcAvailable, setRpcAvailable] = useState(false);
  const [booted, setBooted] = useState(false);
  const [freeGames, setFreeGames] = useState(readFreeGames);
  const profileAddress = useRef(null);
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const freeRoomId = params.get("free");
    const requestedMinutes = Number(params.get("freeMinutes"));
    const freeMinutes = FREE_TIME_CONTROLS.some(({ value }) => value === requestedMinutes)
      ? requestedMinutes
      : 5;
    return freeRoomId && /^[a-zA-Z0-9-]{8,80}$/.test(freeRoomId)
      ? {
          name: "free",
          mode: params.get("freeMode") === "bot" ? "bot" : "online",
          roomId: freeRoomId,
          isHost: params.get("freeHost") === "1",
          minutes: freeMinutes,
        }
      : { name: "lobby" };
  });
  const [notice, setNotice] = useState("");
  const [inviteGameId, setInviteGameId] = useState(() => {
    const p = new URLSearchParams(window.location.search).get("game");
    return p && /^\d+$/.test(p) ? Number(p) : null;
  });

  const notify = useCallback((msg) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 6000);
  }, []);

  const refreshBalance = useCallback(async (prov, addr, d) => {
    const token = getToken(prov);
    const bal = await token.balanceOf(addr);
    setBalance(formatUnits(bal, d));
  }, []);

  useEffect(() => {
    if (!activeAccount?.address) {
      setProvider(readProvider);
      setSigner(null);
      setAddress(null);
      setChainId(null);
      setBalance("0");
      setRpcAvailable(false);
      return;
    }

    if (!readProvider) {
      notify("Thirdweb client is not configured");
      return;
    }

    let cancelled = false;

    async function syncWallet() {
      try {
        const p = readProvider;
        const s = ethers6Adapter.signer.toEthers({
          client: thirdwebClient,
          chain: bsc,
          account: activeAccount,
        });
        const addr = activeAccount.address;
        const walletChainId = activeWallet?.getChain()?.id ?? BNB_CHAIN_ID;

        if (cancelled) return;

        setProvider(p);
        setSigner(s);
        setAddress(addr);
        setChainId(BigInt(walletChainId));
        const d = await getToken(p).decimals();
        if (cancelled) return;
        setDecimals(d);
        await refreshBalance(p, addr, d);

        if (walletChainId !== BNB_CHAIN_ID) {
          notify(t("wrongNetwork"));
        }
      } catch (e) {
        if (!cancelled) {
          notify(e.shortMessage || e.message || String(e));
        }
      }
    }

    syncWallet();
    return () => {
      cancelled = true;
    };
  }, [activeAccount, activeWallet, readProvider, notify, refreshBalance, t]);

  useEffect(() => {
    if (!provider || !activeAccount?.address) {
      setRpcAvailable(false);
      return undefined;
    }

    let alive = true;
    async function checkRpcConnection() {
      try {
        await provider.getBlockNumber();
        if (alive) setRpcAvailable(true);
      } catch (error) {
        console.error("Wallet RPC connection check failed:", error);
        if (alive) setRpcAvailable(false);
      }
    }

    checkRpcConnection();
    const interval = window.setInterval(checkRpcConnection, 30_000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [provider, activeAccount?.address]);

  useEffect(() => {
    if (!address) {
      profileAddress.current = null;
      return;
    }

    const normalizedAddress = address.toLowerCase();
    if (profileAddress.current === normalizedAddress) return;
    profileAddress.current = normalizedAddress;

    if (!inviteGameId) {
      setView((currentView) =>
        currentView.name === "lobby" ? { name: "profile" } : currentView
      );
    }
  }, [address, inviteGameId]);

  useEffect(() => {
    const startTimer = window.setTimeout(() => setBooted(true), 350);
    return () => window.clearTimeout(startTimer);
  }, []);

  useEffect(() => {
    if (view.name !== "free" || view.mode !== "online") return;
    setFreeGames(
      saveFreeGame({
        roomId: view.roomId,
        mode: view.mode,
        minutes: view.minutes,
        isHost: view.isHost,
      })
    );
  }, [view]);

  const resumeFreeGame = useCallback((game) => {
    const url = new URL(window.location.href);
    url.searchParams.set("free", game.roomId);
    url.searchParams.set("freeMode", game.mode);
    url.searchParams.set("freeHost", game.isHost ? "1" : "0");
    url.searchParams.set("freeMinutes", String(game.minutes));
    window.history.replaceState({}, "", url);
    setView({ name: "free", ...game });
  }, []);

  const forgetFreeGame = useCallback((roomId) => {
    setFreeGames(removeFreeGame(roomId));
  }, []);

  function startFreeGame(mode, minutes = 5) {
    const roomId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const url = new URL(window.location.href);
    url.searchParams.set("free", roomId);
    url.searchParams.set("freeMode", mode);
    url.searchParams.set("freeHost", "1");
    url.searchParams.set("freeMinutes", String(minutes));
    window.history.replaceState({}, "", url);
    setView({ name: "free", mode, roomId, isHost: true, minutes });
  }

  function exitFreeGame() {
    const url = new URL(window.location.href);
    url.searchParams.delete("free");
    url.searchParams.delete("freeMode");
    url.searchParams.delete("freeHost");
    url.searchParams.delete("freeMinutes");
    window.history.replaceState({}, "", url);
    setView({ name: address ? "profile" : "lobby" });
  }

  return (
    <div className="app">
      <div className={`splash ${booted ? "hidden" : ""}`} aria-live="polite">
        <div className="splash-inner">
          <div className="splash-icon">♞</div>
          <div className="splash-title">CryptoChess</div>
          <div className="splash-subtitle">Loading game</div>
        </div>
      </div>
      <Header
        address={address}
        balance={balance}
        decimals={decimals}
        chainId={chainId}
        thirdwebClient={thirdwebClient}
        onLang={(l) => i18n.changeLanguage(l)}
        lang={i18n.language}
        onProfile={() => setView({ name: "profile" })}
        onLobby={() => setView({ name: "lobby" })}
      />
      {notice && <div className="toast">{notice}</div>}
      {view.name === "free" ? (
        <FreeGameRoom
          key={view.roomId}
          mode={view.mode}
          roomId={view.roomId}
          isHost={view.isHost}
          minutes={view.minutes}
          onExit={exitFreeGame}
          onDelete={forgetFreeGame}
          notify={notify}
        />
      ) : view.name === "profile" ? (
        <Profile
          address={address}
          signer={signer}
          provider={provider}
          thirdwebClient={thirdwebClient}
          walletConnectionHealthy={
            Boolean(activeAccount?.address) &&
            address?.toLowerCase() === activeAccount.address.toLowerCase() &&
            walletConnectionStatus === "connected" &&
            Number(chainId) === BNB_CHAIN_ID &&
            rpcAvailable
          }
          onDisconnectWallet={() => {
            if (activeWallet) disconnect(activeWallet);
          }}
          decimals={decimals}
          onBack={() => setView({ name: "lobby" })}
          onPlay={(gameId, color) => setView({ name: "room", gameId, color })}
          onFreePlay={startFreeGame}
          freeGames={freeGames}
          onResumeFree={resumeFreeGame}
          onDeleteFree={forgetFreeGame}
          notify={notify}
        />
      ) : view.name === "room" ? (
        <GameRoom
          signer={signer}
          provider={provider}
          address={address}
          gameId={view.gameId}
          decimals={decimals}
          onExit={() => setView({ name: "lobby" })}
          notify={notify}
        />
      ) : (
        <Lobby
          address={address}
          signer={signer}
          provider={provider}
          decimals={decimals}
          thirdwebClient={thirdwebClient}
          onConnect={() => {}}
          onProfile={() => setView({ name: "profile" })}
          onFreePlay={startFreeGame}
          freeGames={freeGames}
          onResumeFree={resumeFreeGame}
          onDeleteFree={forgetFreeGame}
          onPlay={(gameId, color) => setView({ name: "room", gameId, color })}
          inviteGameId={inviteGameId}
          onInviteClose={() => setInviteGameId(null)}
          notify={notify}
        />
      )}
      <footer className="footer">
        {t("subtitle")} · BNB Smart Chain · 5% fee to the fund
      </footer>
    </div>
  );
}