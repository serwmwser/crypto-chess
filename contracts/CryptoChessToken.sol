// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @notice Fixed-supply game token. The initial supply is minted once to the treasury.
contract CryptoChessToken is ERC20, ERC20Burnable {
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 ether;

    error ZeroTreasury();

    constructor(address treasury) ERC20("Crypto Chess", "CCHESS") {
        if (treasury == address(0)) revert ZeroTreasury();
        _mint(treasury, INITIAL_SUPPLY);
    }
}