// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../libraries/LibOrder.sol";
import "../libraries/LibSig.sol";

interface ILimitOrderProtocol {
    error InvalidSignature();
    error OrderExpired();
    error NotMatchingOrders();
    error InvalidBuyAsset();

    event NormalOrderFilled(
        bytes32 orderHash,
        address maker,
        address taker,
        address makerToken,
        address takerToken,
        uint256 makerAmountFilled,
        uint256 takerAmountFilled
    );

    event MultiAssetOrderFilled(
        bytes32 orderHash,
        address maker,
        address taker,
        address makerToken,
        address takerToken,
        uint256 makerAmountFilled,
        uint256 takerAmountFilled
    );

    function fillNormalOrder(
        LibOrder.NormalOrder calldata,
        LibSig.Signature calldata,
        uint256 fillAmount
    ) external returns (uint256 makerUsedAmount, uint256 takerFilledAmount);

    function fillMultiAssetOrder(
        LibOrder.MultiAssetOrder calldata,
        LibSig.Signature calldata,
        LibOrder.MultiAssetFillData calldata
    ) external returns (uint256 makerUsedAmount, uint256 takerFilledAmount);
}
