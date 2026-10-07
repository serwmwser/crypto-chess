// ------------------ Конфигурация сети и контрактов ------------------
export const BNB_CHAIN_ID = 56;

// Реальный GROK-адрес, который используется как основной токен сети и как резерв обменника.
export const GROK_TOKEN_ADDRESS =
  import.meta.env.VITE_GROK_TOKEN_ADDRESS || "0x62a3e247e28cad2d2902cd2dc2e6aea7cdd14444";

// Адрес задеплоенного токена CCHESS в BNB Smart Chain; можно переопределить в окружении.
export const CCHESS_TOKEN_ADDRESS =
  import.meta.env.VITE_CCHESS_TOKEN_ADDRESS ||
  import.meta.env.VITE_GAME_TOKEN_ADDRESS ||
  "0x2370413909571bA45f77A536A4CaA18a7112C8EE";

// Адрес задеплоенного обменника GROK/CCHESS в BNB Smart Chain.
export const CCHESS_EXCHANGE_ADDRESS =
  import.meta.env.VITE_CCHESS_EXCHANGE_ADDRESS ||
  import.meta.env.VITE_GAME_EXCHANGE_ADDRESS ||
  "0xc25E472bBfC1512470C4ab34546cf6F5D8b143b7";

// Адрес legacy-эскроу. Можно переопределять через .env для продакшна.
export const ESCROW_ADDRESS =
  import.meta.env.VITE_ESCROW_ADDRESS || "0xD11eF42E2A358c24AC04F8A79Ba7d5C8778F5740";

// BEP-20 игровой токен (0% комиссии)
export const TOKEN_ADDRESS = GROK_TOKEN_ADDRESS;

// Ссылка на покупку игрового токена (Pons Family Launchpad).
// Оставьте пустой — тогда кнопка "Купить токен" откроет страницу токена на BscScan.
export const TOKEN_BUY_URL =
  "https://four.meme/token/0x62a3e247e28cad2d2902cd2dc2e6aea7cdd14444?code=AHGX96R5GHK9";
export const TOKEN_EXPLORER_URL = `https://bscscan.com/token/${TOKEN_ADDRESS}`;

// Адрес WebSocket relay для синхронизации ходов (npm run server).
export const RELAY_URL =
  import.meta.env.VITE_RELAY_URL ||
  (import.meta.env.DEV ? `ws://${window.location.hostname || "localhost"}:8081` : "");

// Правила ставок (в единицах токена, не в десяналах)
export const STAKE_MIN = 50_000;
export const STAKE_MAX = 1_000_000;
export const STAKE_STEP = 50_000;

// Допустимые длительности партии, секунд
export const DURATIONS = [
  { value: 900, key: "t15" },
  { value: 1800, key: "t30" },
  { value: 3600, key: "t1h" },
  { value: 86_400, key: "t1d" },
];

export const FREE_TIME_CONTROLS = [
  { value: 5, key: "t5" },
  { value: 15, key: "t15" },
  { value: 30, key: "t30" },
  { value: 60, key: "t1h" },
  { value: 1_440, key: "t1d" },
];
