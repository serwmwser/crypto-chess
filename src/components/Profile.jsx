import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatUnits } from "ethers";
import { ConnectButton } from "thirdweb/react";
import { bsc } from "thirdweb/chains";
import {
  fetchGames,
  escrowReady,
  formatStake,
  getToken,
  ZERO_ADDR,
} from "../lib/contracts";
import {
  DURATIONS,
  FREE_TIME_CONTROLS,
  TOKEN_ADDRESS,
} from "../lib/config";
import InviteCard from "./InviteCard";
import CreateGameForm from "./CreateGameForm";
import OpenGamesList from "./OpenGamesList";
import FreeGamesList from "./FreeGamesList";
import OnlineMatchSearch from "./OnlineMatchSearch";

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
  const [freeMinutes, setFreeMinutes] = useState(5);

  useEffect(() => {
    if (address) return;
    setGames(null);
    setAllGames(null);
    setTokenBalance(null);
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