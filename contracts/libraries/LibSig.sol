// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library LibSig {
    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }
}
