import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatUnits, parseUnits } from "ethers";
import { ConnectButton } from "thirdweb/react";
import { bsc } from "thirdweb/chains";
import {
  fetchGames,
  escrowReady,
  shortAddr,
  formatStake,
  getToken,
  getGameToken,
  getCChessExchange,
  getCChessExchangeView,
  cchessReady,
  ZERO_ADDR,
} from "../lib/contracts";
import {
  BNB_CHAIN_ID,
  CCHESS_EXCHANGE_ADDRESS,
  CCHESS_TOKEN_ADDRESS,
  DURATIONS,
  FREE_TIME_CONTROLS,
  TOKEN_BUY_URL,
  TOKEN_EXPLORER_URL,
  TOKEN_ADDRESS,
} from "../lib/config";
import InviteCard from "./InviteCard";
import CreateGameForm from "./CreateGameForm";
import OpenGamesList from "./OpenGamesList";
import FreeGamesList from "./FreeGamesList";
import OnlineMatchSearch from "./OnlineMatchSearch";

const buyTokenLink = TOKEN_BUY_URL || TOKEN_EXPLORER_URL;
const nftCollectionUrl = "https://www.launchmynft.io/collections/0xc2e5650f84Eeb9e4011afbb398108ea302cB17A6/OSybY7wrJOlTC7aTXvWN";

function parseTokenAmount(value) {
  const normalized = value.replace(/[\s\u00a0\u202f]/g, "");
  if (!/^\d*(\.\d*)?$/.test(normalized)) {
    throw new Error("invalid-token-amount");
  }
  return parseUnits(normalized || "0", 18);
}

const appInviteUrl = (address) =>
  `${window.location.origin}${window.location.pathname}${address ? `?ref=${address}` : ""}`;

export default function Profile({
  address,
  signer,
  provider,
  thirdwebClient,
  walletConnectionHealthy,
  onDisconnectWallet,
  decimals,
  onBack,
  onPlay,
  onFreePlay,
  freeGames,
  onResumeFree,
  onDeleteFree,
  notify,
}) {
  const { t } = useTranslation();
  const [games, setGames] = useState(null);
  const [allGames, setAllGames] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(null);
  const [grokBalance, setGrokBalance] = useState(null);
  const [grokBalanceRaw, setGrokBalanceRaw] = useState(null);
  const [cchessBalance, setCchessBalance] = useState(null);
  const [grokReserve, setGrokReserve] = useState(null);
  const [cchessInventory, setCchessInventory] = useState(null);
  const [cchessInventoryRaw, setCchessInventoryRaw] = useState(null);
  const [buyCChessAmount, setBuyCChessAmount] = useState("0");
  const [sellCChessAmount, setSellCChessAmount] = useState("0");
  const [swapBusy, setSwapBusy] = useState(false);
  const [swapStatus, setSwapStatus] = useState("");
  const [swapError, setSwapError] = useState("");
  const [exchangeError, setExchangeError] = useState("");
  const [freeMinutes, setFreeMinutes] = useState(5);

  useEffect(() => {
    if (address) return;
    setGames(null);
    setAllGames(null);
    setTokenBalance(null);
    setGrokBalance(null);
    setGrokBalanceRaw(null);
    setCchessBalance(null);
    setSwapError("");
    setSwapStatus("");
    setExchangeError("");
  }, [address]);

  useEffect(() => {
    if (!address || !provider || !escrowReady()) return;
    let alive = true;
    fetchGames(provider, 200)
      .then((g) => {
        if (!alive) return;
        setAllGames(g);
        setGames(
          g.filter(
            (x) =>
              x.creator.toLowerCase() === address.toLowerCase() ||
              x.challenger.toLowerCase() === address.toLowerCase()
          )
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [address, provider, decimals]);

  useEffect(() => {
    if (!address || !provider) return;
    let alive = true;
    getToken(provider)
      .balanceOf(address)
      .then((bal) => alive && setTokenBalance(formatUnits(bal, decimals)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [address, provider, decimals]);

  useEffect(() => {
    if (!address || !provider || !cchessReady()) return;
    let alive = true;
    Promise.all([
      getToken(provider).balanceOf(address),
      getGameToken(provider).balanceOf(address),
      getCChessExchangeView(provider).grokReserve(),
      getCChessExchangeView(provider).gameTokenInventory(),
    ])
      .then(([gBalance, cBalance, reserve, inventory]) => {
        if (!alive) return;
        setGrokBalance(formatUnits(gBalance, 18));
        setGrokBalanceRaw(gBalance);
        setCchessBalance(formatUnits(cBalance, 18));
        setGrokReserve(formatUnits(reserve, 18));
        setCchessInventory(formatUnits(inventory, 18));
        setCchessInventoryRaw(inventory);
      })
      .catch((error) => {
        console.error("Could not load CCHESS exchange balances:", error);
        if (alive) setExchangeError(error.shortMessage || error.message || String(error));
      });
    return () => {
      alive = false;
    };
  }, [address, provider]);

  async function refreshExchangeState() {
    if (!address || !provider || !cchessReady()) return;
    const [gBalance, cBalance, reserve, inventory] = await Promise.all([
      getToken(provider).balanceOf(address),
      getGameToken(provider).balanceOf(address),
      getCChessExchangeView(provider).grokReserve(),
      getCChessExchangeView(provider).gameTokenInventory(),
    ]);
    setGrokBalance(formatUnits(gBalance, 18));
    setGrokBalanceRaw(gBalance);
    setCchessBalance(formatUnits(cBalance, 18));
    setGrokReserve(formatUnits(reserve, 18));
    setCchessInventory(formatUnits(inventory, 18));
    setCchessInventoryRaw(inventory);
  }

  // --- ИСПРАВЛЕННАЯ ФУНКЦИЯ ПОКУПКИ (ВЫЗЫВАЕТ КОШЕЛЕК) ---
  async function handleBuyCChess() {
    if (!address || !signer || !provider || !cchessReady()) {
      notify?.(t("needConnect"));
      return;
    }

    let amount;
    try {
      amount = parseTokenAmount(buyCChessAmount);
    } catch (error) {
      const message = error.message === "invalid-token-amount"
        ? t("invalidTokenAmount")
        : error.shortMessage || error.message || String(error);
      setSwapError(message);
      notify?.(message);
      return;
    }

    if (amount <= 0n) return;

    setSwapBusy(true);
    setSwapError("");
    setSwapStatus("");

    try {
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== BNB_CHAIN_ID) {
        throw new Error(t("exchangeWrongNetwork"));
      }

      const requiredGrok = await getToken(provider).balanceOf(address);
      const availableCChess = await getCChessExchangeView(provider).gameTokenInventory();
      
      setGrokBalance(formatUnits(requiredGrok, 18));
      setGrokBalanceRaw(requiredGrok);
      setCchessInventory(formatUnits(availableCChess, 18));
      setCchessInventoryRaw(availableCChess);

      if (requiredGrok < amount) {
        throw new Error(t("exchangeInsufficientGrok", {
          required: Number(formatUnits(amount, 18)).toLocaleString(),
          available: Number(formatUnits(requiredGrok, 18)).toLocaleString(),
        }));
      }
      if (availableCChess < amount) {
        throw new Error(t("exchangeInsufficientCChess", {
          available: Number(formatUnits(availableCChess, 18)).toLocaleString(),
        }));
      }

      // 1. ЗАПРОС НА ПОДПИСЬ В КОШЕЛЬКЕ (Approve)
      const grok = getToken(signer);
      const allowance = await grok.allowance(address, CCHESS_EXCHANGE_ADDRESS);
      
      if (allowance < amount) {
        setSwapStatus(t("exchangeApproveWallet"));
        const approval = await grok.approve(CCHESS_EXCHANGE_ADDRESS, amount);
        setSwapStatus(t("exchangeWaitingConfirmation"));
        await approval.wait();
      }

      // 2. ЗАПРОС НА ПОДПИСЬ В КОШЕЛЬКЕ (Buy)
      const exchange = getCChessExchange(signer);
      setSwapStatus(t("exchangeConfirmBuy"));
      const tx = await exchange.buy(amount);
      setSwapStatus(t("exchangeWaitingConfirmation"));
      await tx.wait();

      // 3. УСПЕХ
      setBuyCChessAmount("0");
      setSwapStatus("");
      notify?.(t("exchangeBuySuccess"));
      
      try {
        await refreshExchangeState();
      } catch (error) {
        console.error("Purchase succeeded, but exchange balances could not be refreshed:", error);
        setExchangeError(error.shortMessage || error.message || t("exchangeRefreshFailed"));
      }
    } catch (error) {
      const message = error.shortMessage || error.reason || error.message || t("exchangeFailed");
      setSwapError(message);
      setSwapStatus("");
      notify?.(message);
    } finally {
      setSwapBusy(false);
    }
  }

  // --- ИСПРАВЛЕННАЯ ФУНКЦИЯ ПРОДАЖИ (ВЫЗЫВАЕТ КОШЕЛЕК) ---
  async function handleSellCChess() {
    if (!address || !signer || !provider || !cchessReady()) {
      notify?.(t("needConnect"));
      return;
    }

    let amount;
    try {
      amount = parseTokenAmount(sellCChessAmount);
    } catch (error) {
      const message = error.message === "invalid-token-amount"
        ? t("invalidTokenAmount")
        : error.shortMessage || error.message || String(error);
      setSwapError(message);
      notify?.(message);
      return;
    }

    if (amount <= 0n) return;

    setSwapBusy(true);
    setSwapError("");
    setSwapStatus("");

    try {
      const token = getGameToken(signer);
      const allowance = await token.allowance(address, CCHESS_EXCHANGE_ADDRESS);
      
      if (allowance < amount) {
        setSwapStatus(t("exchangeApproveWallet"));
        const approval = await token.approve(CCHESS_EXCHANGE_ADDRESS, amount);
        setSwapStatus(t("exchangeWaitingConfirmation"));
        await approval.wait();
      }

      const exchange = getCChessExchange(signer);
      setSwapStatus(t("exchangeConfirmBuy"));
      const tx = await exchange.sell(amount);
      setSwapStatus(t("exchangeWaitingConfirmation"));
      await tx.wait();

      setSellCChessAmount("0");
      setSwapStatus("");
      notify?.(t("txSent"));
      
      await refreshExchangeState();
    } catch (error) {
      const message = error.shortMessage || error.reason || error.message || t("exchangeFailed");
      setSwapError(message);
      setSwapStatus("");
      notify?.(message);
    } finally {
      setSwapBusy(false);
    }
  }

  const stats = (() => {
    let wins = 0, losses = 0, draws = 0, won = 0, lost = 0;
    if (games) {
      for (const g of games) {
        if (g.status === 1) continue;
        const isCreator = g.creator.toLowerCase() === address.toLowerCase();
        if (g.status === 3) {
          draws++;
        } else if (g.status === 2 && g.winner && g.winner !== ZERO_ADDR) {
          const iWon = g.winner.toLowerCase() === address.toLowerCase();
          if (iWon) {
            wins++;
            won += Number(formatStake(BigInt(g.stakeCreator) + BigInt(g.stakeChallenger), decimals)) * 0.95;
          } else {
            losses++;
            lost += Number(formatStake(isCreator ? g.stakeCreator : g.stakeChallenger, decimals));
          }
        }
      }
    }
    const finished = wins + losses + draws;
    return { wins, losses, draws, won, lost, finished };
  })();

  const durKey = (d) => (DURATIONS.find((x) => x.value === d) || { key: "t15" }).key;
  
  let parsedBuyAmount = 0n;
  let buyAmountValid = true;
  try {
    parsedBuyAmount = parseTokenAmount(buyCChessAmount);
  } catch {
    parsedBuyAmount = 0n;
    buyAmountValid = false;
  }
  
  const insufficientGrokForBuy = parsedBuyAmount > 0n && grokBalanceRaw !== null && parsedBuyAmount > grokBalanceRaw;
  const insufficientInventoryForBuy = parsedBuyAmount > 0n && cchessInventoryRaw !== null && parsedBuyAmount > cchessInventoryRaw;

  return (
    <div className="page profile-page">
      <button className="btn btn-ghost" onClick={onBack}>{t("back")}</button>
      <div className="card profile-card">
        <h2>{t("profileTitle")}</h2>
        <div className={`wallet-status ${walletConnectionHealthy ? "wallet-status-ok" : "wallet-status-warn"}`} role="status" aria-live="polite">
          <span className="wallet-status-dot" aria-hidden="true" />
          {walletConnectionHealthy ? t("walletConnectionHealthy") : t("walletConnectionUnavailable")}
        </div>
        {address ? (
          <>
            <div className="kv">
              <span>{t("walletAddress")}</span>
              <code>{address}</code>
            </div>
            <button className="btn btn-wallet-disconnect" onClick={onDisconnectWallet}>
              {t("disconnectWallet")}
            </button>
            <div className="ad-banner">
              <h3 className="ad-title">{t("adTitle")}</h3>
              <p className="ad-text">{t("adText")}</p>
              <a className="btn btn-primary buy-token" href={buyTokenLink} target="_blank" rel="noreferrer noopener">
                {t("adBuy")}
              </a>
              <p className="muted small">{t("buyTokenHint", { addr: TOKEN_ADDRESS })}</p>
            </div>
            <div className="stats">
              <div className="stat"><b>{stats.finished}</b><span>{t("statsGames")}</span></div>
              <div className="stat win"><b>{stats.wins}</b><span>{t("statsWins")}</span></div>
              <div className="stat lose"><b>{stats.losses}</b><span>{t("statsLosses")}</span></div>
              <div className="stat draw"><b>{stats.draws}</b><span>{t("statsDraws")}</span></div>
            </div>
            <div className="balance-window">
              <div className="stat balance"><b>{tokenBalance ? Number(tokenBalance).toLocaleString("en-US") : "…"}</b><span>{t("balanceAvailable")} ●</span></div>
              <div className="stat win"><b>{Math.round(stats.won).toLocaleString("en-US")}</b><span>{t("tokensWon")} ●</span></div>
              <div className="stat lose"><b>{Math.round(stats.lost).toLocaleString("en-US")}</b><span>{t("tokensLost")} ●</span></div>
            </div>
            <p className="muted small">{t("drawReturnNote")}</p>
          </>
        ) : (
          <div className="wallet-connect-prompt">
            <p>{t("needConnect")}</p>
            {thirdwebClient ? (
              <ConnectButton client={thirdwebClient} chain={bsc} connectButton={{ label: t("connect") }} connectModal={{ title: t("connect") }} />
            ) : null}
          </div>
        )}
      </div>

      <div className="card">
        <h3>{t("cChessExchangeTitle")}</h3>
        {cchessReady() ? (
          <>
            <p className="muted small">{t("cChessExchangeNote")}</p>
            {exchangeError && <p className="error" role="alert">{exchangeError}</p>}
            {swapError && <p className="error" role="alert">{swapError}</p>}
            <p className="muted small">
              {t("exchangeRateAndBalance", { balance: grokBalance === null ? "…" : Number(grokBalance).toLocaleString("en-US") })}
            </p>
            <div className="balance-window">
              <div className="stat balance"><b>{cchessBalance ? Number(cchessBalance).toLocaleString("en-US") : "…"}</b><span>{t("cChessBalance")}</span></div>
              <div className="stat win"><b>{grokReserve ? Number(grokReserve).toLocaleString("en-US") : "…"}</b><span>{t("grokReserve")}</span></div>
              <div className="stat draw"><b>{cchessInventory ? Number(cchessInventory).toLocaleString("en-US") : "…"}</b><span>{t("cChessInventory")}</span></div>
            </div>
            <div className="swap-grid">
              <div className="swap-box">
                <h4>{t("buyCChess")}</h4>
                <div className="swap-row">
                  <input type="text" inputMode="decimal" value={buyCChessAmount} onChange={(event) => { setBuyCChessAmount(event.target.value); setSwapError(""); }} placeholder="0.0" aria-label={t("buyCChessAmount")} />
                  <button className="btn btn-primary btn-sm" onClick={handleBuyCChess} disabled={swapBusy || !address || !signer || grokBalanceRaw === null || cchessInventoryRaw === null || parsedBuyAmount <= 0n || insufficientGrokForBuy || insufficientInventoryForBuy}>
                    {swapBusy ? t("exchangeProcessing") : t("buyCChess")}
                  </button>
                </div>
                {insufficientGrokForBuy && <p className="warn" role="status">{t("exchangeInsufficientGrok", { required: Number(formatUnits(parsedBuyAmount, 18)).toLocaleString("en-US"), available: Number(grokBalance).toLocaleString("en-US") })}</p>}
                {!buyAmountValid && <p className="warn" role="status">{t("invalidTokenAmount")}</p>}
                {insufficientInventoryForBuy && <p className="warn" role="status">{t("exchangeInsufficientCChess", { available: Number(cchessInventory).toLocaleString("en-US") })}</p>}
                {swapStatus && <p className="muted small" role="status">{swapStatus}</p>}
              </div>
              <div className="swap-box">
                <h4>{t("sellCChess")}</h4>
                <div className="swap-row">
                  <input type="text" inputMode="decimal" value={sellCChessAmount} onChange={(event) => setSellCChessAmount(event.target.value)} placeholder="0.0" />
                  <button className="btn btn-ghost btn-sm" onClick={handleSellCChess} disabled={swapBusy || !address || !signer || grokReserve === null || Number(grokReserve) <= 0}>
                    {t("sellCChess")}
                  </button>
                </div>
              </div>
            </div>
            {grokReserve !== null && Number(grokReserve) <= 0 && <p className="warn" role="status">{t("cChessReserveEmpty")}</p>}
            <p className="muted small">{t("cChessExchangeHint", { token: CCHESS_TOKEN_ADDRESS, exchange: CCHESS_EXCHANGE_ADDRESS })}</p>
          </>
        ) : (
          <p className="warn" role="status">{t("cChessExchangeUnavailable")}</p>
        )}
      </div>

      <div className="card nft-promo">
        <div>
          <h3>{t("nftTitle")}</h3>
          <p className="muted small">{t("nftDescription")}</p>
        </div>
        <a className="btn btn-primary" href={nftCollectionUrl} target="_blank" rel="noreferrer noopener">{t("nftBuy")}</a>
      </div>

      <div className="card free-play-card">
        <div>
          <h3>{t("freePlay")}</h3>
          <p className="muted small">{t("freePlayDescription")}</p>
        </div>
        <div className="free-play-options">
          <label className="free-time-control">
            {t("gameTimeControl")}
            <select value={freeMinutes} onChange={(event) => setFreeMinutes(Number(event.target.value))}>
              {FREE_TIME_CONTROLS.map(({ value, key }) => (<option key={value} value={value}>{t(key)}</option>))}
            </select>
          </label>
          <div className="free-play-actions">
            <button className="btn btn-primary" onClick={() => onFreePlay("bot", freeMinutes)}>{t("playBot")}</button>
            <button className="btn btn-ghost" onClick={() => onFreePlay("online", freeMinutes)}>{t("createOpponentGame")}</button>
            <OnlineMatchSearch minutes={freeMinutes} onMatch={onResumeFree} notify={notify} />
          </div>
        </div>
      </div>

      <div className="card free-games-card">
        <h3>{t("myFreeGames")}</h3>
        <FreeGamesList games={freeGames} onResume={onResumeFree} onDelete={onDeleteFree} notify={notify} />
      </div>

      <div className="card">
        <h3>{t("createMyGame")}</h3>
        <CreateGameForm address={address} signer={signer} provider={provider} decimals={decimals} onCreated={(id) => onPlay(id, "w")} notify={notify} />
      </div>

      <div className="card">
        <h3>{t("joinGames")}</h3>
        <OpenGamesList games={allGames} address={address} signer={signer} provider={provider} decimals={decimals} onPlay={onPlay} notify={notify} />
      </div>

      <InviteCard title={t("inviteTitle")} note={t("inviteRefNote")} url={appInviteUrl(address)} text={t("inviteText")} />

      <div className="card">
        <h3>{t("myGames")}</h3>
        {!games ? (
          <p className="muted">—</p>
        ) : games.length === 0 ? (
          <p className="muted">{t("noGames")}</p>
        ) : (
          <ul className="gamelist">
            {games.map((g) => {
              const statusText = g.status === 0 ? t("wait") : g.status === 1 ? t("inProgress") : t("ended");
              return (
                <li key={g.id}>
                  <span>#{g.id}</span>
                  <span>{t(durKey(g.duration))}</span>
                  <span>{Number(formatStake(g.stakeCreator, decimals)).toLocaleString("en-US")} ●</span>
                  <span className="muted">{statusText}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}