// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./libraries/TransferHelper.sol";
import "./libraries/MerkleProof.sol";
import "./libraries/LibOrder.sol";
import "./libraries/LibSig.sol";
import "./interfaces/ILimitOrderProtocol.sol";

contract LimitOrderProtocol is ILimitOrderProtocol {
    bytes32 normalOrderTypeHash =
        0x1ea07b2f68e14e3d68d672e1c263fbc02572251f3ca40130bbf20e13d09ce4f8;

    bytes32 multiAssetOrderTypeHash =
        0xaeb37aa68c8eec0ee8f4ff20da64a6179a410d509b6b20028979268b24f64647;

    bytes32 public immutable DOMAIN_SEPARATOR;

    constructor() {
        uint chainId;
        assembly {
            chainId := chainid()
        }
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("LimitOrderProtocol")),
                keccak256(bytes("1")),
                chainId,
                address(this)
            )
        );
    }

    mapping(bytes32 => uint) private filledAmounts;
    mapping(bytes32 => uint) private multiAssetSoldAmounts;

    function getNormalOrderHash(
        LibOrder.NormalOrder calldata order
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(
                        abi.encode(
                            normalOrderTypeHash,
                            order.maker,
                            order.taker,
                            order.makerToken,
                            order.takerToken,
                            order.makerAmount,
                            order.takerAmount,
                            order.expiry
                        )
                    )
                )
            );
    }

    function fillNormalOrder(
        LibOrder.NormalOrder calldata order,
        LibSig.Signature calldata signature,
        uint256 fillAmount
    ) external returns (uint256 makerUsedAmount, uint256 takerFilledAmount) {
        if (order.expiry < block.timestamp) {
            revert OrderExpired();
        }

        bytes32 orderHash = getNormalOrderHash(order);
        if (
            ecrecover(orderHash, signature.v, signature.r, signature.s) !=
            order.maker
        ) {
            revert InvalidSignature();
        }

        uint orderFilledAmount = filledAmounts[orderHash];
        uint fillableAmount = order.takerAmount - orderFilledAmount;
        uint fillingAmount = fillAmount < fillableAmount
            ? fillAmount
            : fillableAmount;

        uint ordermakerAmount = (fillingAmount * order.makerAmount) /
            order.takerAmount;

        filledAmounts[orderHash] += fillingAmount;

        TransferHelper.safeTransferFrom(
            order.makerToken,
            order.maker,
            msg.sender,
            ordermakerAmount
        );
        TransferHelper.safeTransferFrom(
            order.takerToken,
            msg.sender,
            order.maker,
            fillingAmount
        );

        emit NormalOrderFilled(
            orderHash,
            order.maker,
            msg.sender,
            order.makerToken,
            order.takerToken,
            ordermakerAmount,
            fillingAmount
        );

        return (ordermakerAmount, fillingAmount);
    }

    function getMultiAssetOrderHash(
        LibOrder.MultiAssetOrder calldata multiAssetOrder
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(
                        abi.encode(
                            multiAssetOrderTypeHash,
                            multiAssetOrder.maker,
                            multiAssetOrder.taker,
                            multiAssetOrder.makerToken,
                            multiAssetOrder.makerAmount,
                            multiAssetOrder.takerAssetMixHash,
                            multiAssetOrder.expiry
                        )
                    )
                )
            );
    }

    function fillMultiAssetOrder(
        LibOrder.MultiAssetOrder calldata multiAssetOrder,
        LibSig.Signature calldata signature,
        LibOrder.MultiAssetFillData calldata fillData
    ) external returns (uint256 makerUsedAmount, uint256 takerFilledAmount) {
        if (multiAssetOrder.expiry < block.timestamp) {
            revert OrderExpired();
        }

        bytes32 orderHash = getMultiAssetOrderHash(multiAssetOrder);
        if (
            ecrecover(orderHash, signature.v, signature.r, signature.s) !=
            multiAssetOrder.maker
        ) {
            revert InvalidSignature();
        }

        {
            bytes32 buyAssetHash = keccak256(
                abi.encodePacked(
                    fillData.fillToken,
                    fillData.fillTokenOrderAmount
                )
            );

            if (
                !MerkleProof.verifyCalldata(
                    fillData.proof,
                    multiAssetOrder.takerAssetMixHash,
                    buyAssetHash
                )
            ) {
                revert InvalidBuyAsset();
            }
        }

        uint ordermakerAmount;
        uint fillingAmount;
        {
            uint orderSoldAmount = multiAssetSoldAmounts[orderHash];
            uint fillableAmount = ((multiAssetOrder.makerAmount -
                orderSoldAmount) * fillData.fillTokenOrderAmount) /
                multiAssetOrder.makerAmount;
            fillingAmount = fillData.fillAmount < fillableAmount
                ? fillData.fillAmount
                : fillableAmount;

            ordermakerAmount =
                (fillingAmount * multiAssetOrder.makerAmount) /
                fillData.fillTokenOrderAmount;
        }

        multiAssetSoldAmounts[orderHash] += ordermakerAmount;

        TransferHelper.safeTransferFrom(
            multiAssetOrder.makerToken,
            multiAssetOrder.maker,
            msg.sender,
            ordermakerAmount
        );
        TransferHelper.safeTransferFrom(
            fillData.fillToken,
            msg.sender,
            multiAssetOrder.maker,
            fillingAmount
        );

        emit MultiAssetOrderFilled(
            orderHash,
            multiAssetOrder.maker,
            msg.sender,
            multiAssetOrder.makerToken,
            fillData.fillToken,
            ordermakerAmount,
            fillingAmount
        );

        return (ordermakerAmount, fillingAmount);
    }
}
