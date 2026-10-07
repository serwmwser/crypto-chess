import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MaxUint256 } from "ethers";
import { getEscrow, getEscrowToken, formatStake, shortAddr } from "../lib/contracts";
import { DURATIONS, ESCROW_ADDRESS } from "../lib/config";

// Список открытых матчей, к которым можно присоединиться (ставка = ставка создателя).
export default function OpenGamesList({ games, address, signer, provider, decimals, onPlay, notify }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const open = (games || []).filter((g) => g.status === 0);

  async function joinGame(game) {
    if (!signer || busy) return;
    setBusy(true);
    try {
      const token = await getEscrowToken(provider);
      const amount = BigInt(game.stakeCreator);
      const allowance = await token.allowance(address, ESCROW_ADDRESS);
      if (allowance < amount) {
        notify(t("sendingTx"));
        await (await token.connect(signer).approve(ESCROW_ADDRESS, MaxUint256)).wait();
      }
      notify(t("sendingTx"));
      const tx = await getEscrow(signer).joinGame(game.id, amount);
      notify(t("txSent"));
      await tx.wait();
      if (onPlay) onPlay(game.id, "b");
    } catch (e) {
      notify(e.shortMessage || e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  if (open.length === 0) return <p className="muted">{t("noGames")}</p>;

  return (
    <ul className="gamelist">
      {open.map((g) => (
        <li key={g.id} className="game-item">
          <span className="gid">#{g.id}</span>
          <span>{t((DURATIONS.find((d) => d.value === g.duration) || { key: "t15" }).key)}</span>
          <span>
            {t("stakeOf")}: {Number(formatStake(g.stakeCreator, decimals)).toLocaleString("en-US")} ●
          </span>
          <span className="muted">{shortAddr(g.creator)}</span>
          <button
            className="btn btn-primary btn-sm"
            disabled={!address || busy || g.creator.toLowerCase() === address?.toLowerCase()}
            onClick={() => joinGame(g)}
          >
            {t("join")}
          </button>
        </li>
      ))}
    </ul>
  );
}
