import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MaxUint256, parseUnits } from "ethers";
import { getEscrow, getEscrowToken } from "../lib/contracts";
import { STAKE_MIN, STAKE_MAX, STAKE_STEP, DURATIONS, ESCROW_ADDRESS } from "../lib/config";

export default function CreateGameForm({ address, signer, provider, onCreated, notify }) {
  const { t } = useTranslation();
  const [stake, setStake] = useState(String(STAKE_MIN));
  const [duration, setDuration] = useState(900);
  const [busy, setBusy] = useState(false);

  const stakeNum = Number(stake);
  const stakeValid =
    Number.isFinite(stakeNum) &&
    stakeNum >= STAKE_MIN &&
    stakeNum <= STAKE_MAX &&
    (stakeNum - STAKE_MIN) % STAKE_STEP === 0;

  async function createGame() {
    if (!address || !provider || !signer || !stakeValid || busy) return;
    setBusy(true);
    try {
      const token = await getEscrowToken(provider);
      const tokenDecimals = Number(await token.decimals());
      const amount = parseUnits(String(stakeNum), tokenDecimals);
      const allowance = await token.allowance(address, ESCROW_ADDRESS);
      if (allowance < amount) {
        notify(t("sendingTx"));
        await (await token.connect(signer).approve(ESCROW_ADDRESS, MaxUint256)).wait();
      }
      notify(t("sendingTx"));
      const tx = await getEscrow(signer).createGame(amount, duration);
      notify(t("txSent"));
      await tx.wait();
      const count = Number(await getEscrow(provider).gameCount());
      if (onCreated) onCreated(count - 1);
    } catch (e) {
      notify(e.shortMessage || e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form">
      <label>
        {t("time")}
        <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
          {DURATIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {t(d.key)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("stake")}
        <input
          type="number"
          min={STAKE_MIN}
          max={STAKE_MAX}
          step={STAKE_STEP}
          value={stake}
          onChange={(e) => setStake(e.target.value)}
        />
        <small>{t("stakeHint")}</small>
      </label>
      {!stakeValid && <p className="error">{t("invalidStake")}</p>}
      <button
        className="btn btn-primary"
        disabled={!address || !provider || !signer || !stakeValid || busy}
        onClick={createGame}
      >
        {busy ? " Processing..." : "♟ " + t("create")}
      </button>
      {(!address || !provider || !signer) && (
        <p className="muted">{t("needConnect")}</p>
      )}
    </div>
  );
}