// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function decimals() external view returns (uint8);
}

/// @notice Шахматные матчи со ставками в USDC (Polygon).
/// Ставки: 10¢...$10 шаг 10¢. Комиссия feeBps -> feeRecipient.
/// Комиссия, кошелёк и ставки меняются владельцем без передеплоя.
contract ChessEscrow is Ownable {
    enum Status { Open, Active, Settled, Draw }

    struct Game {
        address creator;
        address challenger;
        uint256 stakeCreator;
        uint256 stakeChallenger;
        uint32 createdAt;
        uint32 startedAt;
        uint32 duration;
        uint8 status;
        address winner;
        bool creatorDraw;
        bool challengerDraw;
    }

    IERC20 public immutable token;
    uint16 public feeBps;
    address public feeRecipient;

    mapping(uint256 => bool) public allowedStakes;
    uint256[] public stakeTiers;

    Game[] private _games;
    uint256 public totalGames;

    event GameCreated(uint256 indexed id, address indexed creator, uint256 stake, uint32 duration);
    event GameJoined(uint256 indexed id, address indexed challenger, uint256 stake, uint32 startedAt);
    event GameCancelled(uint256 indexed id);
    event Resigned(uint256 indexed id, address indexed resigner, address indexed winner);
    event DrawAgreed(uint256 indexed id, address indexed by);
    event DrawSettled(uint256 indexed id, uint256 payoutEach);
    event FeeChanged(uint16 oldFee, uint16 newFee);
    event FeeRecipientChanged(address indexed newRecipient);
    event TierAdded(uint256 stake);
    event TierRemoved(uint256 stake);

    modifier exists(uint256 id) {
        require(id < totalGames, "no game");
        _;
    }

    constructor(IERC20 _token, uint16 _feeBps, address _feeRecipient) Ownable(msg.sender) {
        require(address(_token) != address(0), "zero token");
        require(_feeRecipient != address(0), "zero recipient");
        require(_feeBps <= 1000, "fee > 10%");
        token = _token;
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;

        uint256 unit = 10 ** uint256(_token.decimals());
        for (uint256 c = 10; c <= 1000; c += 10) {
            _addTier((c * unit) / 100);
        }
    }

    function setFeeBps(uint16 newFee) external onlyOwner {
        require(newFee <= 1000, "fee > 10%");
        emit FeeChanged(feeBps, newFee);
        feeBps = newFee;
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        require(newRecipient != address(0), "zero recipient");
        feeRecipient = newRecipient;
        emit FeeRecipientChanged(newRecipient);
    }

    function addTier(uint256 stake) external onlyOwner {
        _addTier(stake);
    }

    function removeTier(uint256 stake) external onlyOwner {
        require(allowedStakes[stake], "no tier");
        allowedStakes[stake] = false;
        for (uint256 i = 0; i < stakeTiers.length; i++) {
            if (stakeTiers[i] == stake) {
                stakeTiers[i] = stakeTiers[stakeTiers.length - 1];
                stakeTiers.pop();
                break;
            }
        }
        emit TierRemoved(stake);
    }

    function _addTier(uint256 stake) internal {
        require(stake > 0, "zero stake");
        require(!allowedStakes[stake], "exists");
        allowedStakes[stake] = true;
        stakeTiers.push(stake);
        emit TierAdded(stake);
    }

    function getStakeTiers() external view returns (uint256[] memory) {
        return stakeTiers;
    }

    function createGame(uint256 stake, uint32 duration) external returns (uint256 id) {
        require(allowedStakes[stake], "stake not in tiers");
        require(
            duration == 900 || duration == 1800 || duration == 3600 || duration == 86_400,
            "duration 15m/30m/1h/24h"
        );
        id = _games.length;
        _games.push(Game({
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
        }));
        totalGames = _games.length;
        require(_safeTransferFrom(msg.sender, stake), "approve token");
        emit GameCreated(id, msg.sender, stake, duration);
        return id;
    }

    function joinGame(uint256 id, uint256 stake) external exists(id) {
        Game storage g = _games[id];
        require(g.status == uint8(Status.Open), "not open");
        require(msg.sender != g.creator, "self join");
        require(stake == g.stakeCreator, "stake mismatch");
        require(_safeTransferFrom(msg.sender, stake), "approve token");
        g.challenger = msg.sender;
        g.stakeChallenger = stake;
        g.startedAt = uint32(block.timestamp);
        g.status = uint8(Status.Active);
        emit GameJoined(id, msg.sender, stake, g.startedAt);
    }

    function cancelGame(uint256 id) external exists(id) {
        Game storage g = _games[id];
        require(g.status == uint8(Status.Open), "not open");
        require(msg.sender == g.creator, "creator only");
        g.status = uint8(Status.Settled);
        _send(g.creator, g.stakeCreator);
        emit GameCancelled(id);
    }

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
            _send(g.creator, payoutEach);
            _send(g.challenger, payoutEach);
            emit DrawSettled(id, payoutEach);
        }
    }

    function gameCount() external view returns (uint256) {
        return _games.length;
    }

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