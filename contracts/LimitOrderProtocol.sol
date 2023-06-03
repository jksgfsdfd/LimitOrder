// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./libraries/TransferHelper.sol";
import "./libraries/MerkleProof.sol";
import "./libraries/LibOrder.sol";
import "./libraries/LibSig.sol";
import "./interfaces/ILimitOrderProtocol.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

error NotAuthorized();

contract LimitOrderProtocol is ILimitOrderProtocol, UUPSUpgradeable, Initializable {
    bytes32 normalOrderTypeHash;

    bytes32 multiAssetOrderTypeHash;

    bytes32 public DOMAIN_SEPARATOR;

    function initializeV1(address implementation) external initializer()  {
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
        normalOrderTypeHash = 0x1ea07b2f68e14e3d68d672e1c263fbc02572251f3ca40130bbf20e13d09ce4f8;
        multiAssetOrderTypeHash=0xaeb37aa68c8eec0ee8f4ff20da64a6179a410d509b6b20028979268b24f64647;
        _changeAdmin(msg.sender);
        _upgradeTo(implementation);
    }

    mapping(bytes32 => uint) private normalOrderSoldAmounts;
    mapping(bytes32 => uint) private multiAssetOrderSoldAmounts;

    function getSellAndFillAmount(
        uint256 makerOrderAmount,
        uint256 takerOrderAmount,
        uint256 makerSoldAmount,
        uint256 fillRequestAmount
    ) private pure returns (uint256 makerSellAmount, uint256 takerFillAmount) {
        uint256 fillableAmount = Math.mulDiv(
            (makerOrderAmount - makerSoldAmount),
            takerOrderAmount,
            makerOrderAmount
        );
        takerFillAmount = fillRequestAmount < fillableAmount
            ? fillRequestAmount
            : fillableAmount;
        makerSellAmount = Math.mulDiv(
            takerFillAmount,
            makerOrderAmount,
            takerOrderAmount
        );
    }

    function getNormalOrderHash(
        LibOrder.NormalOrder calldata order
    ) private view returns (bytes32) {
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

    function doSwap(
        address makerToken,
        address takerToken,
        address maker,
        address taker,
        uint256 makerAmount,
        uint256 takerAmount
    ) private {
        TransferHelper.safeTransferFrom(makerToken, maker, taker, makerAmount);
        TransferHelper.safeTransferFrom(takerToken, taker, maker, takerAmount);
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

        (uint ordermakerAmount, uint fillingAmount) = getSellAndFillAmount(
            order.makerAmount,
            order.takerAmount,
            normalOrderSoldAmounts[orderHash],
            fillAmount
        );

        normalOrderSoldAmounts[orderHash] += ordermakerAmount;

        doSwap(
            order.makerToken,
            order.takerToken,
            order.maker,
            msg.sender,
            ordermakerAmount,
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
        LibOrder.MultiAssetOrder calldata order,
        LibSig.Signature calldata signature,
        LibOrder.MultiAssetFillData calldata fillData
    ) external returns (uint256 makerUsedAmount, uint256 takerFilledAmount) {
        if (order.expiry < block.timestamp) {
            revert OrderExpired();
        }

        bytes32 orderHash = getMultiAssetOrderHash(order);
        if (
            ecrecover(orderHash, signature.v, signature.r, signature.s) !=
            order.maker
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
                    order.takerAssetMixHash,
                    buyAssetHash
                )
            ) {
                revert InvalidBuyAsset();
            }
        }

        (uint ordermakerAmount, uint fillingAmount) = getSellAndFillAmount(
            order.makerAmount,
            fillData.fillTokenOrderAmount,
            multiAssetOrderSoldAmounts[orderHash],
            fillData.fillAmount
        );

        multiAssetOrderSoldAmounts[orderHash] += ordermakerAmount;

        doSwap(
            order.makerToken,
            fillData.fillToken,
            order.maker,
            msg.sender,
            ordermakerAmount,
            fillingAmount
        );

        emit MultiAssetOrderFilled(
            orderHash,
            order.maker,
            msg.sender,
            order.makerToken,
            fillData.fillToken,
            ordermakerAmount,
            fillingAmount
        );

        return (ordermakerAmount, fillingAmount);
    }

    function _authorizeUpgrade(
        address //newImplementation
    ) internal virtual override {
        if(msg.sender != _getAdmin()){
            revert NotAuthorized();
        }
    }
}
