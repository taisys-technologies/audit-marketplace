// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

library ERC721AStorageCustom {
    struct Layout {
        // all periods sum up
        uint256 _availableTokenSupply;
        // current period
        uint256 _periodTokenSupply;
        // contract max NFT
        uint256 _maxTokenSupply;
        // signer who authorize mint (backend)
        address _signerAddress;
        // record used uuid
        mapping(string => bool) _usedUUID;
        // paytment token
        address _paymentContract;
        // price of per NFT
        uint256 _price;
        // addr who already mint
        mapping(address => bool) _minted;
    }

    bytes32 internal constant STORAGE_SLOT =
        keccak256("ERC721A.contracts.customStorage.ERC721A");

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
