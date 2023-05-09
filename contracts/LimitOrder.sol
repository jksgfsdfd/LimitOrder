// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./libraries/TransferHelper.sol";
import "./libraries/MerkleProof.sol";

error InvalidSignature();
error OrderExpired();
error NotMatchingOrders();
error InvalidBuyAsset();

contract LimitOrderProtocol {
    struct Signature {
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct NormalOrder {
        address seller;
        address buyer;
        address sellToken;
        address buyToken;
        uint256 sellAmount;
        uint256 buyAmount;
        uint256 expiry;
    }

    enum OrderStatus {
        ACTIVE,
        EXPIRED
    }

    struct MultiAssetOrder {
        address seller;
        address buyer;
        address sellToken;
        uint256 sellAmount;
        bytes32 buyAssetMixHash;
        uint256 expiry;
    }

    //change this
    bytes32 orderTypeHash =
        0xeb643b38ea5be8468b6e850da3c45b4cfe5b757ffe2d23e6d4973d0f2bc1df1e;

    // change this
    bytes32 multiAssetOrderTypeHash =
        0xdaed9b80c698508abaee3200b9d1cb42d6ccdbc18dad9b7dfdf8d241fd8d6d16;

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
        NormalOrder calldata order
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(
                        abi.encode(
                            orderTypeHash,
                            order.seller,
                            order.buyer,
                            order.sellToken,
                            order.buyToken,
                            order.sellAmount,
                            order.buyAmount,
                            order.expiry
                        )
                    )
                )
            );
    }

    function fillOrder(
        Order calldata order,
        Signature calldata signature,
        uint256 fillAmount
    ) external {
        if (order.expiry < block.timestamp) {
            revert OrderExpired();
        }

        bytes32 orderHash = getNormalOrderHash(order);
        if (
            ecrecover(orderHash, signature.v, signature.r, signature.s) !=
            order.seller
        ) {
            revert InvalidSignature();
        }

        uint orderFilledAmount = filledAmounts[orderHash];
        uint fillableAmount = order.buyAmount - orderFilledAmount;
        uint fillingAmount = fillAmount < fillableAmount
            ? fillAmount
            : fillableAmount;

        uint orderSellAmount = (fillingAmount * order.sellAmount) /
            order.buyAmount;

        filledAmounts[orderHash] += fillingAmount;

        TransferHelper.safeTransferFrom(
            order.sellToken,
            order.seller,
            msg.sender,
            orderSellAmount
        );
        TransferHelper.safeTransferFrom(
            order.buyToken,
            msg.sender,
            order.seller,
            fillingAmount
        );
    }

    function getMultiAssetOrderHash(
        MultiAssetOrder calldata multiAssetOrder
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR,
                    keccak256(
                        abi.encode(
                            multiAssetOrderTypeHash,
                            multiAssetOrder.seller,
                            multiAssetOrder.buyer,
                            multiAssetOrder.sellToken,
                            multiAssetOrder.sellAmount,
                            multiAssetOrder.buyAssetMixHash,
                            multiAssetOrder.expiry
                        )
                    )
                )
            );
    }

    function fillMultiAssetOrder(
        MultiAssetOrder calldata multiAssetOrder,
        Signature calldata signature,
        address fillToken,
        uint256 fillTokenOrderAmount,
        uint256 fillAmount,
        bytes32[] calldata proof
    ) external {
        bytes32 orderHash = getMultiAssetOrderHash(multiAssetOrder);
        if (
            ecrecover(orderHash, signature.v, signature.r, signature.s) !=
            multiAssetOrder.seller
        ) {
            revert InvalidSignature();
        }

        bytes32 buyAssetHash = keccak256(
            abi.encodePacked(fillToken, fillTokenOrderAmount)
        );

        if (
            !MerkleProof.verifyCalldata(
                proof,
                multiAssetOrder.buyAssetMixHash,
                buyAssetHash
            )
        ) {
            revert InvalidBuyAsset();
        }

        uint orderSoldAmount = multiAssetSoldAmounts[orderHash];
        uint fillableAmount = ((multiAssetOrder.sellAmount - orderSoldAmount) *
            fillTokenOrderAmount) / multiAssetOrder.sellAmount;
        uint fillingAmount = fillAmount < fillableAmount
            ? fillAmount
            : fillableAmount;

        uint orderSellAmount = (fillingAmount * multiAssetOrder.sellAmount) /
            fillTokenOrderAmount;

        multiAssetSoldAmounts[orderHash] += orderSellAmount;

        TransferHelper.safeTransferFrom(
            multiAssetOrder.sellToken,
            multiAssetOrder.seller,
            msg.sender,
            orderSellAmount
        );
        TransferHelper.safeTransferFrom(
            fillToken,
            msg.sender,
            multiAssetOrder.seller,
            fillingAmount
        );
    }
}
