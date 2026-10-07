import { useTranslation } from "react-i18next";
import { ConnectButton } from "thirdweb/react";
import { bsc } from "thirdweb/chains";
import CreateGameForm from "./CreateGameForm";
import OpenGamesList from "./OpenGamesList";
import FreeGamesList from "./FreeGamesList";
import OnlineMatchSearch from "./OnlineMatchSearch";
import InviteCard from "./InviteCard";
import { FREE_TIME_CONTROLS } from "../lib/config";

export default function Lobby({
  address,
  signer,
  provider,
  decimals,
  thirdwebClient,
  onConnect,
  onProfile,
  onFreePlay,
  freeGames,
  onResumeFree,
  onDeleteFree,
  onPlay,
  inviteGameId,
  onInviteClose,
  notify,
}) {
  const { t } = useTranslation();

  return (
    <div className="main-content">
      {/* HERO SECTION - Главный призыв */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="pulse"></span>
            <span>Web3 Powered · BNB Chain</span>
          </div>
          <h1 className="hero-title">
            Play Chess, <span className="highlight">Mine Tokens</span>,<br />
            Build Your Crypto Empire
          </h1>
          <p className="hero-subtitle">
            Connect your wallet or account to start playing chess for real crypto rewards. 
            Win matches, earn tokens, and climb the global leaderboard.
          </p>
          <div className="hero-cta">
            {address ? (
              <>
                <button className="btn btn-primary btn-lg" onClick={() => onFreePlay("bot", 15)}>
                  ♟ {t("playBot")}
                </button>
                <button className="btn btn-secondary btn-lg" onClick={() => onFreePlay("online", 15)}>
                  ⚔ {t("createOpponentGame")}
                </button>
                <button className="btn btn-ghost btn-lg" onClick={onProfile}>
                  👤 {t("profile")}
                </button>
              </>
            ) : (
              <ConnectButton
                client={thirdwebClient}
                chain={bsc}
                connectButton={{
                  label: "🔗 Connect Wallet to Start",
                  style: {
                    background: "var(--accent-green)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "18px 36px",
                    fontSize: "17px",
                    fontWeight: "600",
                    boxShadow: "0 4px 12px rgba(129, 182, 76, 0.4)",
                  },
                }}
              />
            )}
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-value">∞</div>
              <div className="hero-stat-label">Games Played</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">5%</div>
              <div className="hero-stat-label">Winner Pool Fee</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">BSC</div>
              <div className="hero-stat-label">Network</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value">P2P</div>
              <div className="hero-stat-label">Fair Play</div>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN LOBBY CONTENT */}
      <div className="page" style={{ marginTop: "32px" }}>
        {/* FREE PLAY SECTION */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <span className="icon">🎮</span>
              {t("freePlay")}
            </h3>
          </div>
          <p className="muted" style={{ marginBottom: "20px" }}>
            {t("freePlayDescription")}
          </p>
          <div className="free-play-options">
            <label className="free-time-control">
              {t("gameTimeControl")}
              <select
                defaultValue={5}
                onChange={(event) => {
                  const minutes = Number(event.target.value);
                  // Store for use in buttons
                  window.__freeMinutes = minutes;
                }}
              >
                {FREE_TIME_CONTROLS.map(({ value, key }) => (
                  <option key={value} value={value}>
                    {t(key)}
                  </option>
                ))}
              </select>
            </label>
            <div className="free-play-actions">
              <button
                className="btn btn-primary"
                onClick={() => onFreePlay("bot", window.__freeMinutes || 5)}
              >
                🤖 {t("playBot")}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => onFreePlay("online", window.__freeMinutes || 5)}
              >
                 {t("createOpponentGame")}
              </button>
              <OnlineMatchSearch
                minutes={window.__freeMinutes || 5}
                onMatch={onResumeFree}
                notify={notify}
              />
            </div>
          </div>
        </div>

        {/* MY FREE GAMES */}
        {freeGames && freeGames.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <span className="icon">📋</span>
                {t("myFreeGames")}
              </h3>
            </div>
            <FreeGamesList
              games={freeGames}
              onResume={onResumeFree}
              onDelete={onDeleteFree}
              notify={notify}
            />
          </div>
        )}

        {/* CREATE GAME */}
        {address && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <span className="icon"></span>
                {t("createMyGame")}
              </h3>
            </div>
            <CreateGameForm
              address={address}
              signer={signer}
              provider={provider}
              decimals={decimals}
              onCreated={(id) => onPlay(id, "w")}
              notify={notify}
            />
          </div>
        )}

        {/* JOIN GAMES */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <span className="icon">⚔️</span>
              {t("joinGames")}
            </h3>
          </div>
          <OpenGamesList
            games={null}
            address={address}
            signer={signer}
            provider={provider}
            decimals={decimals}
            onPlay={onPlay}
            notify={notify}
          />
        </div>

        {/* INVITE */}
        {address && (
          <InviteCard
            title={t("inviteTitle")}
            note={t("inviteRefNote")}
            url={`${window.location.origin}${window.location.pathname}?ref=${address}`}
            text={t("inviteText")}
          />
        )}
      </div>
    </div>
  );
}