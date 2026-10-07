import { useTranslation } from "react-i18next";
import { ConnectButton } from "thirdweb/react";
import { bsc } from "thirdweb/chains";
import { shortAddr } from "../lib/contracts";

export default function Header({
  address,
  balance,
  decimals,
  chainId,
  thirdwebClient,
  onLang,
  lang,
  onProfile,
  onLobby,
}) {
  const { t } = useTranslation();
  const isWrongNetwork = chainId && Number(chainId) !== 56;

  return (
    <header className="header">
      <div className="header-left">
        <button className="logo" onClick={onLobby}>
          <span className="logo-icon">♞</span>
          <span className="logo-text">CryptoChess</span>
        </button>
        <nav className="header-nav">
          <button className="nav-link" onClick={onLobby}>
            {t("play")}
          </button>
          {address && (
            <button className="nav-link" onClick={onProfile}>
              {t("profile")}
            </button>
          )}
        </nav>
      </div>
      <div className="header-right">
        {address && (
          <div className="balance-display">
            <span className="coin-icon">●</span>
            <span>{Number(balance).toLocaleString("en-US")}</span>
          </div>
        )}
        <div className="lang-switcher">
          <button
            className={`lang-btn ${lang === "en" ? "active" : ""}`}
            onClick={() => onLang("en")}
          >
            EN
          </button>
          <button
            className={`lang-btn ${lang === "ru" ? "active" : ""}`}
            onClick={() => onLang("ru")}
          >
            RU
          </button>
        </div>
        {thirdwebClient ? (
          <ConnectButton
            client={thirdwebClient}
            chain={bsc}
            connectButton={{
              label: address ? shortAddr(address) : t("connect"),
              style: {
                background: address ? "var(--bg-tertiary)" : "var(--accent-green)",
                color: "white",
                border: address ? "1px solid var(--border-color)" : "none",
                borderRadius: "8px",
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: "600",
              },
            }}
            detailsButton={{
              style: {
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
              },
            }}
            showBalance={false}
          />
        ) : null}
      </div>
    </header>
  );
}