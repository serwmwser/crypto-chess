// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ChessEscrow
 * @notice Escrow-контракт для шахматных матчей со ставками в BEP-20 токене.
 *
 *  - Игрок-создатель открывает матч, внося ставку (>= 50 000 токенов).
 *  - Вызовшийся игрок вносит ставку не меньше ставки создателя — матч активен.
 *  - Результат (resign, время истекло -> проигравший подтверждает, ничья):
 *      победителю  -> 100% - feeBps
 *      feeRecipient -> feeBps (5% = 500 bps)
 *
 * Деплой: ChessEscrow(token, feeBps=500, feeRecipient=0xc2e5650f84Eeb9e4011afbb398108ea302cB17A6)
 * Токен:  0x62a3e247e28cad2d2902cd2dc2e6aea7cdd14444 (BNB Smart Chain, 0% комиссии)
 */

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function decimals() external view returns (uint8);
}

contract ChessEscrow {
    enum Status { Open, Active, Settled, Draw }

    struct Game {
        address creator;
        address challenger;
        uint256 stakeCreator;
        uint256 stakeChallenger;
        uint32 createdAt;
        uint32 startedAt;   // timestamp, когда второй игрок присоединился
        uint32 duration;    // длительность партии в секундах
        uint8 status;
        address winner;     // 0 при отмене/ничьей
        bool creatorDraw;
        bool challengerDraw;
    }

    IERC20 public immutable token;
    uint16 public immutable feeBps;
    address public immutable feeRecipient;
    uint256 public minStake;

    Game[] private _games;
    uint256 public totalGames;

    event GameCreated(uint256 indexed id, address indexed creator, uint256 stake, uint32 duration);
    event GameJoined(uint256 indexed id, address indexed challenger, uint256 stake, uint32 startedAt);
    event GameCancelled(uint256 indexed id);
    event Resigned(uint256 indexed id, address indexed resigner, address indexed winner);
    event DrawAgreed(uint256 indexed id, address indexed by);
    event DrawSettled(uint256 indexed id, uint256 payoutEach);

    modifier exists(uint256 id) {
        require(id < totalGames, "no game");
        _;
    }

    constructor(IERC20 _token, uint16 _feeBps, address _feeRecipient) {
        require(address(_token) != address(0), "zero token");
        require(_feeRecipient != address(0), "zero recipient");
        require(_feeBps <= 1000, "fee > 10%");
        uint256 d = _token.decimals();
        require(d >= 1 && d <= 18, "bad decimals");
        token = _token;
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
        minStake = 50_000 * (10 ** d);
    }

    /// @notice Открыть матч. Длительность: 900 / 1800 / 3600 / 86400 секунд.
    function createGame(uint256 stake, uint32 duration) external returns (uint256 id) {
        require(stake >= minStake, "min stake 50k");
        require(
            duration == 900 || duration == 1800 || duration == 3600 || duration == 86_400,
            "duration 15m/30m/1h/24h"
        );
        id = _games.length;
        _games.push(
            Game({
                creator: msg.sender,
                challenger: address(0),
                stakeCreator: stake,
                stakeChallenger: 0,
                createdAt: uint32(block.timestamp),
                startedAt: 0,
                duration: duration,
                status: uint8(Status.Open),
                winner: address(0),
                creatorDraw: false,
                challengerDraw: false
            })
        );
        totalGames = _games.length;
        require(_safeTransferFrom(msg.sender, stake), "approve token");
        emit GameCreated(id, msg.sender, stake, duration);
        return id;
    }

    /// @notice Присоединиться к матчу со ставкой не меньше ставки создателя.
    function joinGame(uint256 id, uint256 stake) external exists(id) {
        Game storage g = _games[id];
        require(g.status == uint8(Status.Open), "not open");
        require(msg.sender != g.creator, "self join");
        require(stake >= g.stakeCreator, "stake too low");
        require(_safeTransferFrom(msg.sender, stake), "approve token");
        g.challenger = msg.sender;
        g.stakeChallenger = stake;
        g.startedAt = uint32(block.timestamp);
        g.status = uint8(Status.Active);
        emit GameJoined(id, msg.sender, stake, g.startedAt);
    }

    /// @notice Создатель может отменить матч до подключения соперника.
    function cancelGame(uint256 id) external exists(id) {
        Game storage g = _games[id];
        require(g.status == uint8(Status.Open), "not open");
        require(msg.sender == g.creator, "creator only");
        g.status = uint8(Status.Settled);
        _send(g.creator, g.stakeCreator);
        emit GameCancelled(id);
    }

    /// @notice Сдача партии (по желанию или из-за истечения времени).
    ///        Проигравший вызывает функцию; победитель получает 100% - feeBps.
    function resign(uint256 id) external exists(id) {
        Game storage g = _games[id];
        require(g.status == uint8(Status.Active), "not active");
        address winner;
        if (msg.sender == g.creator) {
            winner = g.challenger;
        } else {
            require(msg.sender == g.challenger, "not a player");
            winner = g.creator;
        }
        g.status = uint8(Status.Settled);
        g.winner = winner;
        _payoutWinner(g, winner);
        emit Resigned(id, msg.sender, winner);
    }

    /// @notice Согласиться на ничью. Когда оба игрока согласны — ставки полностью
    ///         возвращаются игрокам (по 50% каждого), комиссия при ничьей НЕ удерживается.
    function agreeDraw(uint256 id) external exists(id) {
        Game storage g = _games[id];
        require(g.status == uint8(Status.Active), "not active");
        if (msg.sender == g.creator) {
            require(!g.creatorDraw, "already");
            g.creatorDraw = true;
        } else {
            require(msg.sender == g.challenger, "not a player");
            require(!g.challengerDraw, "already");
            g.challengerDraw = true;
        }
        emit DrawAgreed(id, msg.sender);
        if (g.creatorDraw && g.challengerDraw) {
            g.status = uint8(Status.Draw);
            uint256 pot = g.stakeCreator + g.stakeChallenger;
            uint256 payoutEach = pot / 2;
            g.winner = address(0);
            // При ничьей баланс возвращается игрокам, комиссия не удерживается
            _send(g.creator, payoutEach);
            _send(g.challenger, payoutEach);
            emit DrawSettled(id, payoutEach);
        }
    }

    // ---------- views ----------

    function gameCount() external view returns (uint256) {
        return _games.length;
    }

    function getGame(
        uint256 id
    )
        external
        view
        exists(id)
        returns (
            address creator,
            address challenger,
            uint256 stakeCreator,
            uint256 stakeChallenger,
            uint32 startedAt,
            uint32 duration,
            uint8 status,
            address winner,
            bool creatorDraw,
            bool challengerDraw
        )
    {
        Game storage g = _games[id];
        return (
            g.creator,
            g.challenger,
            g.stakeCreator,
            g.stakeChallenger,
            g.startedAt,
            g.duration,
            g.status,
            g.winner,
            g.creatorDraw,
            g.challengerDraw
        );
    }

    // ---------- internals ----------

    function _fee(uint256 amount) internal view returns (uint256) {
        return (amount * feeBps) / 10_000;
    }

    function _payoutWinner(Game storage g, address winner) internal {
        uint256 pot = g.stakeCreator + g.stakeChallenger;
        uint256 fee = _fee(pot);
        _send(feeRecipient, fee);
        _send(winner, pot - fee);
    }

    function _send(address to, uint256 value) internal {
        require(_safeTransfer(to, value), "transfer failed");
    }

    function _safeTransfer(address to, uint256 value) private returns (bool ok) {
        (bool success, bytes memory data) =
            address(token).call(abi.encodeCall(IERC20.transfer, (to, value)));
        ok = success && (data.length == 0 || abi.decode(data, (bool)));
    }

    function _safeTransferFrom(address from, uint256 value) private returns (bool ok) {
        (bool success, bytes memory data) =
            address(token).call(abi.encodeCall(IERC20.transferFrom, (from, address(this), value)));
        ok = success && (data.length == 0 || abi.decode(data, (bool)));
    }
}
