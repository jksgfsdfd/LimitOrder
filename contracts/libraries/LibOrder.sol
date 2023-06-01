// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library LibOrder {
    struct NormalOrder {
        address maker;
        address taker;
        address makerToken;
        address takerToken;
        uint256 makerAmount;
        uint256 takerAmount;
        uint256 expiry;
    }

    struct MultiAssetOrder {
        address maker;
        address taker;
        address makerToken;
        uint256 makerAmount;
        bytes32 takerAssetMixHash;
        uint256 expiry;
    }

    struct MultiAssetFillData {
        address fillToken;
        uint256 fillTokenOrderAmount;
        uint256 fillAmount;
        bytes32[] proof;
    }
}
