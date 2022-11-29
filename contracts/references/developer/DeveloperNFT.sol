// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "erc721a-upgradeable/contracts/extensions/ERC721AQueryableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import {ERC721AStorageCustom} from "./ERC721AStorageCustom.sol";
import "./AccessControlUpgradeableCustom.sol";
import "./ERC721URIStorageUpgradeable.sol";

contract DeveloperNFT is
    ERC721AQueryableUpgradeable,
    ERC721URIStorageUpgradeable,
    EIP712Upgradeable,
    PausableUpgradeable,
    AccessControlUpgradeableCustom,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable
{
    using ERC721AStorageCustom for ERC721AStorageCustom.Layout;
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * Global Variables
     */

    bytes32 private constant _CHECKTOKEN_TYPEHASH =
        keccak256(
            "CheckToken(string uuid,address userAddress,uint256 deadline,string uri)"
        );

    /**
     * Events
     */

    event SetSignerAddress(address signerAddress);
    event SetPrice(uint256 price);
    event PeriodTokenSupply(uint256 periodTokenSupply);
    event SetMaxTokenSupply(uint256 maxTokenSupply);

    /**
     * External/Public Functions
     */

    function initialize(
        string memory newName,
        string memory newSymbol,
        uint256 newMaxTokenSupply,
        address newSignerAddress,
        address newPaymentContract,
        uint256 newPrice
    ) public initializerERC721A initializer {
        __ERC721A_init(newName, newSymbol);
        __ERC721AQueryable_init();
        __ERC721URIStorage_init();
        __EIP712_init(newName, "1");
        __Pausable_init();
        __AccessControlCustom_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        require(
            newMaxTokenSupply > 0,
            "ERC721A: maxTokenSupply cannot be smaller than 0"
        );

        require(
            newSignerAddress != address(0) && !newSignerAddress.isContract(),
            "ERC721A: signerAddress cannot be 0x0 and cannot be contract"
        );

        require(
            newPaymentContract != address(0) && newPaymentContract.isContract(),
            "ERC721A: paymentContract cannot be 0x0 and must be contract"
        );
        require(newPrice > 0, "ERC721A: price cannot be smaller than 0");

        ERC721AStorageCustom.layout()._paymentContract = newPaymentContract;
        ERC721AStorageCustom.layout()._price = newPrice;
        ERC721AStorageCustom.layout()._maxTokenSupply = newMaxTokenSupply;
        ERC721AStorageCustom.layout()._signerAddress = newSignerAddress;
        // give role to the address who deployed
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /// @return signerAddress address - address who can sign for mint
    function signerAddress() external view returns (address) {
        return ERC721AStorageCustom.layout()._signerAddress;
    }

    /// @return price uint256 - price of NFT
    function price() external view returns (uint256) {
        return ERC721AStorageCustom.layout()._price;
    }

    /// @return paymentContract address - ERC20 which is payment token for buying NFT
    function paymentContract() external view returns (address) {
        return ERC721AStorageCustom.layout()._paymentContract;
    }

    /// @return maxTokenSupply uint256 - total NFT supply of this contract
    function maxTokenSupply() external view returns (uint256) {
        return ERC721AStorageCustom.layout()._maxTokenSupply;
    }

    /// @return periodTokenSupply uint256 - NFT supply of current period
    function periodTokenSupply() external view returns (uint256) {
        return ERC721AStorageCustom.layout()._periodTokenSupply;
    }

    /// @return totalMinted uint256 - the total amount of tokens minted in this contract
    function totalMinted() public view returns (uint256) {
        return _totalMinted();
    }

    /// @return periodMinted uint256 - the total amount of tokens minted in current period
    function periodMinted() external view returns (uint256) {
        return
            totalMinted() -
            (ERC721AStorageCustom.layout()._availableTokenSupply -
                ERC721AStorageCustom.layout()._periodTokenSupply);
    }

    /// mint 1 NFT with signature signed by signerAddress
    ///
    /// @param uuid string - unique uuid
    /// @param userAddress address - address which mint NFT
    /// @param deadline uint256 - this signature's deadline
    /// @param uri string - uri of NFT
    /// @param signature bytes - signature signed by signerAddress with all above data
    function checkTokenAndMint(
        string calldata uuid,
        address userAddress,
        uint256 deadline,
        string calldata uri,
        bytes memory signature
    ) external whenNotPaused nonReentrant {
        _checkToken(uuid, userAddress, deadline, uri, signature);
        _mint(1, uri);
    }

    /**
     * Admin Functions
     */

    /// Admin can change the signerAddress who can sign the signature for minting NFT
    ///
    /// @param newSignerAddress address - new signer address
    function setSignerAddress(address newSignerAddress)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            newSignerAddress != address(0) && !newSignerAddress.isContract(),
            "ERC721A: signerAddress cannot be 0x0 and cannot be contract"
        );
        ERC721AStorageCustom.layout()._signerAddress = newSignerAddress;
        emit SetSignerAddress(newSignerAddress);
    }

    /// Admin can modify maxTokenSupply of this contract before the NFTs start to be sold
    ///
    /// @param newMaxToken uint256 - new maximum token supply
    function setMaxTokenSupply(uint256 newMaxToken)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            ERC721AStorageCustom.layout()._periodTokenSupply == 0,
            "ERC721A: periodToken already set, cannot change maxToken"
        );
        require(newMaxToken > 0, "ERC721A: maxToken must be greater than 0");
        ERC721AStorageCustom.layout()._maxTokenSupply = newMaxToken;
        emit SetMaxTokenSupply(newMaxToken);
    }

    /// set up the NFT supply of next period
    ///
    /// @param perToken uint256 - token supply of the next period
    function setPeriodTokenSupply(uint256 perToken)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        uint256 availableToken = ERC721AStorageCustom
            .layout()
            ._availableTokenSupply;

        require(
            availableToken == totalMinted(),
            "ERC721A: periodToken haven't all be minted"
        );

        require(
            availableToken + perToken <=
                ERC721AStorageCustom.layout()._maxTokenSupply,
            "ERC721A: sumup over the maxTokenSupply"
        );

        ERC721AStorageCustom.layout()._periodTokenSupply = perToken;
        ERC721AStorageCustom.layout()._availableTokenSupply += perToken;
        emit PeriodTokenSupply(perToken);
    }

    /// set up the price of each NFT
    ///
    /// @param newPrice uint256 - new price
    function setPrice(uint256 newPrice) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newPrice > 0, "ERC721A: price cannot smaller than 0");
        ERC721AStorageCustom.layout()._price = newPrice;
        emit SetPrice(newPrice);
    }

    /// Admin can withdraw ERC20(paymentContract) which are from selling NFT
    ///
    /// @param to address - address who can get ERC20
    /// @param amount uint256 - amount of ERC20
    function withdraw(address to, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        IERC20Upgradeable(ERC721AStorageCustom.layout()._paymentContract)
            .safeTransfer(to, amount);
    }

    /// Admin triggers stopped state
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// Admin returns to normal state.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * Internal Functions
     */

    /// check the signature is sign by signerAddress
    ///
    /// @param uuid string - unique uuid
    /// @param userAddress address - address which mint NFT
    /// @param deadline uint256 - this signature's deadline
    /// @param uri string - uri of NFT
    /// @param signature bytes - signature signed by signerAddress with all above data
    function _checkToken(
        string calldata uuid,
        address userAddress,
        uint256 deadline,
        string calldata uri,
        bytes memory signature
    ) internal {
        require(block.timestamp <= deadline, "ERC712: expired deadline");
        require(
            !ERC721AStorageCustom.layout()._usedUUID[uuid],
            "ERC712: used uuid"
        );
        require(userAddress == _msgSender(), "ERC712: invalid userAddress");

        bytes32 structHash = keccak256(
            abi.encode(
                _CHECKTOKEN_TYPEHASH,
                keccak256(bytes(uuid)),
                userAddress,
                deadline,
                keccak256(bytes(uri))
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSAUpgradeable.recover(hash, signature);
        require(
            signer == ERC721AStorageCustom.layout()._signerAddress,
            "ERC712: invalid signerAddress"
        );
        ERC721AStorageCustom.layout()._usedUUID[uuid] = true;
    }

    /// mint NFT to msgSender
    ///
    /// @param quantity uint256 - amount of NFT to be minted
    /// @param uri string - uri of NFT
    function _mint(uint256 quantity, string calldata uri) internal {
        uint256 cur = ERC721AStorage.layout()._currentIndex;
        require(
            cur + quantity <
                ERC721AStorageCustom.layout()._availableTokenSupply,
            "ERC721ACustom: over the availableTokenSupply"
        );
        require(
            !ERC721AStorageCustom.layout()._minted[_msgSender()],
            "ERC721A: already have one NFT"
        );

        ERC721AStorageCustom.layout()._minted[_msgSender()] = true;

        // _safeMint's second argument now takes in a quantity, not a tokenId.
        _safeMint(_msgSender(), quantity);
        for (uint256 i = cur; i < cur + quantity; i++) {
            _setTokenURI(i, uri);
        }

        // transfer erc20
        IERC20Upgradeable(ERC721AStorageCustom.layout()._paymentContract)
            .safeTransferFrom(
                _msgSender(),
                address(this),
                ERC721AStorageCustom.layout()._price
            );
    }

    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal override whenNotPaused {
        super._beforeTokenTransfers(from, to, startTokenId, quantity);
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(DEFAULT_ADMIN_ROLE)
    {}

    // The following functions are overrides required by Solidity.
    function _burn(uint256 tokenId)
        internal
        override(ERC721AUpgradeable, ERC721URIStorageUpgradeable)
    {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721AUpgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721AUpgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
