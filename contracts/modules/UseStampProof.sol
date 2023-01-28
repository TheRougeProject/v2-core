// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

// import "hardhat/console.sol";

contract UseStampProof {

    // brute force is 128-bit
    function validProof(bytes16 stamp, bytes32 proof) public pure returns (bool valid) {
        return (bytes32(stamp) == keccak256(abi.encodePacked(proof)) >> 128 << 128);
    }

}
