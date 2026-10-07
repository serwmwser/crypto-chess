// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CryptoChessExchangeOpen is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable grok;
    IERC20 public immutable cchess;

    event Bought(address indexed buyer, uint256 amount);
    event Sold(address indexed seller, uint256 amount);

    constructor(address _grok, address _cchess) {
        require(_grok != address(0), "Zero grok");
        require(_cchess != address(0), "Zero cchess");
        grok = IERC20(_grok);
        cchess = IERC20(_cchess);
    }

    function buy(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        require(cchess.balanceOf(address(this)) >= amount, "No inventory");

        grok.safeTransferFrom(msg.sender, address(this), amount);
        cchess.safeTransfer(msg.sender, amount);

        emit Bought(msg.sender, amount);
    }

    function sell(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        require(grok.balanceOf(address(this)) >= amount, "No grok reserve");

        cchess.safeTransferFrom(msg.sender, address(this), amount);
        grok.safeTransfer(msg.sender, amount);

        emit Sold(msg.sender, amount);
    }

    function grokReserve() external view returns (uint256) {
        return grok.balanceOf(address(this));
    }

    function gameTokenInventory() external view returns (uint256) {
        return cchess.balanceOf(address(this));
    }
}
