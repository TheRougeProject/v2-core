// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20 {

    uint8 immutable private _decimals;

    constructor(
                uint256 supply,
                string memory name,
                string memory symbol,
                uint8 decimals
                )
        ERC20(name, symbol) {
        _decimals = decimals;
        _mint(_msgSender(), supply);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

}
