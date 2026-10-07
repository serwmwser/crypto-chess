// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CryptoChessTokenOpen is ERC20 {
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 1 ether;

    constructor(address treasury) ERC20("Crypto Chess", "CCHESS") {
        require(treasury != address(0), "Zero treasury");
        _mint(treasury, INITIAL_SUPPLY);
    }
}
