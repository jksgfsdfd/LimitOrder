// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/ILimitOrderProtocol.sol";
import "@openzeppelin/contracts/utils/StorageSlot.sol";

contract LimitOrderProxy{

bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    constructor(address implementation){
        (bool success,) = implementation.delegatecall(abi.encodeWithSelector(ILimitOrderProtocol.initializeV1.selector,implementation));
        if(!success){
            revert();
        }
    }

    function _delegate(address implementation) internal virtual {
        assembly {
            // Copy msg.data. We take full control of memory in this inline assembly
            // block because it will not return to Solidity code. We overwrite the
            // Solidity scratch pad at memory position 0.
            calldatacopy(0, 0, calldatasize())

            // Call the implementation.
            // out and outsize are 0 because we don't know the size yet.
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)

            // Copy the returned data.
            returndatacopy(0, 0, returndatasize())

            switch result
            // delegatecall returns 0 on error.
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }


    function _fallback() internal virtual {
        _delegate(_getImplementation());
    }

    function _getImplementation() internal view returns (address) {
        return StorageSlot.getAddressSlot(_IMPLEMENTATION_SLOT).value;
    }

    fallback() external virtual {
        _fallback();
    }
}