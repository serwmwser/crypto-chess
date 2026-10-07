// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockGrok is ERC20 {
    constructor() ERC20("Mock GROK", "GRK") {
        _mint(msg.sender, 10_000_000 ether);
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}