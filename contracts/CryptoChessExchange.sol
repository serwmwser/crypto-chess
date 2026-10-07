// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ICryptoChessBurnable is IERC20Metadata {
    function burnFrom(address account, uint256 value) external;
}

/// @notice Fixed 1:1 GROK/CCHESS swaps. GROK remains here as the redemption reserve.
contract CryptoChessExchange is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable grok;
    ICryptoChessBurnable public immutable gameToken;

    error ZeroAddress();
    error ZeroAmount();
    error DecimalsMismatch();
    error InsufficientTokenInventory();
    error InsufficientGrokReserve();
    error UnsupportedTransferFee();

    event Bought(address indexed account, uint256 amount);
    event Sold(address indexed account, uint256 amount);

    constructor(address grokAddress, address gameTokenAddress) {
        if (grokAddress == address(0) || gameTokenAddress == address(0)) revert ZeroAddress();
        if (grokAddress == gameTokenAddress) revert ZeroAddress();
        if (
            IERC20Metadata(grokAddress).decimals() !=
            IERC20Metadata(gameTokenAddress).decimals()
        ) revert DecimalsMismatch();

        grok = IERC20(grokAddress);
        gameToken = ICryptoChessBurnable(gameTokenAddress);
    }

    /// @notice Buy CCHESS by depositing the same amount of GROK.
    function buy(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (gameToken.balanceOf(address(this)) < amount) revert InsufficientTokenInventory();

        uint256 reserveBefore = grok.balanceOf(address(this));
        grok.safeTransferFrom(msg.sender, address(this), amount);
        if (grok.balanceOf(address(this)) - reserveBefore != amount) {
            revert UnsupportedTransferFee();
        }

        IERC20(address(gameToken)).safeTransfer(msg.sender, amount);
        emit Bought(msg.sender, amount);
    }

    /// @notice Burn CCHESS and redeem the same amount of reserved GROK.
    function sell(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (grok.balanceOf(address(this)) < amount) revert InsufficientGrokReserve();

        uint256 grokBefore = grok.balanceOf(msg.sender);
        gameToken.burnFrom(msg.sender, amount);
        grok.safeTransfer(msg.sender, amount);
        if (grok.balanceOf(msg.sender) - grokBefore != amount) {
            revert UnsupportedTransferFee();
        }

        emit Sold(msg.sender, amount);
    }

    function grokReserve() external view returns (uint256) {
        return grok.balanceOf(address(this));
    }

    function gameTokenInventory() external view returns (uint256) {
        return gameToken.balanceOf(address(this));
    }
}