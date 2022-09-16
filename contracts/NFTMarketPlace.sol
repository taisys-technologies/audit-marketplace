// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

contract NFTMarketPlace is 
    Initializable, 
    PausableUpgradeable, 
    ReentrancyGuardUpgradeable,
    AccessControlUpgradeable, 
    UUPSUpgradeable, 
    IERC721ReceiverUpgradeable 
{
    using CountersUpgradeable for CountersUpgradeable.Counter;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    struct MarketItem {
        bool isVegasONE;
        address nftContract;
        address seller;
        uint256 itemId;
        uint256 tokenId;
        uint256 price;
    }

    struct AuctionItem {
        bool isVegasONE;
        address nftContract;
        address highestBidder;
        address seller;
        uint auctionStartTime;
        uint256 itemId;
        uint256 tokenId;
        uint256 highestPrice;
    }

    event CreateMarketItem(
        bool isVegasONE,
        address nftContract,
        address indexed seller,
        uint256 indexed itemId,
        uint256 tokenId,
        uint256 price
    );

    event RemoveMarketItem(
        bool isVegasONE,
        address nftContract,
        address indexed seller,
        uint256 indexed itemId,
        uint256 tokenId,
        uint256 price
    );

    event Buy(
        bool isVegasONE,
        address nftContract,
        address seller,
        address indexed buyer,
        uint256 indexed itemId,
        uint256 tokenId,
        uint256 price,
        uint256 fee
    );

    event Withdraw(
        bool isVegasONE,
        address indexed account,
        address indexed to,
        uint256 amount
    );

    event WithdrawMP(
        bool isVegasONE,
        address indexed account,
        address indexed to,
        uint256 amount
    );

    event CreateAuctionItem(
        bool isVegasONE,
        address nftContract,
        address indexed seller,
        uint auctionStartTime,
        uint256 indexed itemId,
        uint256 tokenId,
        uint256 price
    );

    event RemoveAuctionItem(
        bool isVegasONE,
        address nftContract,
        address indexed seller,
        uint auctionStartTime,
        uint256 indexed itemId,
        uint256 tokenId,
        uint256 price
    );

    event Bid(
        bool isVegasONE,
        address nftContract,
        address seller,
        address indexed buyer,
        uint256 indexed itemId,
        uint256 tokenId,
        uint256 price
    );

    event RevertBid(
        address indexed account,
        address indexed to,
        uint256 indexed itemId,
        uint256 amount
    );

    event AuctionEnd(
        bool isVegasONE,
        address nftContract,
        address seller,
        address indexed buyer,
        uint auctionEndTime,
        uint256 indexed itemId,
        uint256 tokenId,
        uint256 price,
        uint256 fee
    );

    event SetFeePercent(
        address indexed account,
        uint256 feePercent
    );

    event SetWhitelist(
        address indexed account,
        address nftContract
    );

    /**
     * Variables 
     */

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint8 constant thousand = 1000;
    address[] private _whiteliste;
    uint private _biddingTime;
    IERC20Upgradeable private _paymentToken;
    uint256 private _feePercent;
    uint256 private _totalFeeEth;
    uint256 private _totalFeeVegasONE;

    CountersUpgradeable.Counter private _itemIdCounter;
    CountersUpgradeable.Counter private _auctionItemsIdCounter;

    MarketItem[] private _items;
    AuctionItem[] private _auctionItems;

    mapping(uint256 => uint256) private _itemsIndex;
    mapping(uint256 => bool) private _itemsExist;
    mapping(address => uint256[]) private _ownedItems;
    mapping(uint256 => uint256) private _ownedItemsIndex;
    mapping(address => uint256) private _ownedEth;
    mapping(address => uint256) private _ownedVegasONE;

    mapping(address => bool) private _whitelistExist;

    mapping(uint256 => uint256) private _auctionItemsIndex;
    mapping(uint256 => bool) private _auctionItemsExist;
    mapping(uint256 => uint256) private _auctionItemsFee;
    mapping(address => uint256[]) private _ownedAuctionItems;
    mapping(uint256 => uint256) private _ownedAuctionItemsIndex;
    mapping(uint256 => address) private _auctionItemsHighestBidder;
    mapping(address => mapping(uint256 => uint256)) private _ownedBidEth;
    mapping(address => mapping(uint256 => uint256)) private _ownedBidVegasONE;

    /**
     * Errors
     */

    error OnlyAdminCanUse();
    error MarketItemNotFound();
    error AuctionItemNotFound();
    error AddressNotInWhitelist();
    error SelfPurchase();
    error BidderNotFound();
    error HighestBidderCanNotRevertFunds();
    error AmountMustBeGreaterThanZero();
    error InvaildPaymentToken();
    error AddressExistsInWhitelist();
    error FeePercentMustBeA1To1000Number();
    error OnlyAcceptEthForPayment();
    error OnlyAcceptVegasONEForPayment();
    error OnlyRemovedBySellerOrAdmin();
    error CanNotRemovedWhenHighestBidderExist();
    error NotEnoughFunds();
    error HighestBidderIsYou();
    error NotExceedingHighestPrice();
    error NoFundsCanBeRevert();
    error AuctionIsOver();
    error AuctionIsNotOver();
    error NoOneBid();
    error OnlyHighestBidderOrSellerCanEnd();

    function initialize(
        address newPaymentToken,
        uint256 newFeePercent,
        uint newBiddingTime
    ) public initializer {
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(ADMIN_ROLE, _msgSender());
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);

        if (newPaymentToken == address(0)) {
            revert InvaildPaymentToken();
        }

        if (newFeePercent <= 0 || newFeePercent > thousand) {
            revert FeePercentMustBeA1To1000Number();
        }

        _paymentToken = IERC20Upgradeable(newPaymentToken);

        _feePercent = newFeePercent;

        _biddingTime = newBiddingTime * 1 days;
    }

    /**
     * Modifer
     */

    modifier checkAdmin() {
        if (!hasRole(ADMIN_ROLE, _msgSender())) {
            revert OnlyAdminCanUse();
        }
        _;
	}

    modifier checkItemExist(uint256 itemId) {
        if (!_isItemExist(itemId)) {
            revert MarketItemNotFound();
        }
        _;
    }

    modifier checkAuctionItemExist(uint256 itemId) {
        if (!_isAuctionItemExist(itemId)) {
            revert AuctionItemNotFound();
        }
        _;
    }

    modifier checkWhitelist(address nftContract) {
        if (!_isWhitelist(nftContract)) {
            revert AddressNotInWhitelist();
        }
        _;
    }

    modifier checkSeller(uint256 itemId) {
        MarketItem memory item = _getItem(itemId);
        if (_msgSender() == item.seller) {
            revert SelfPurchase();
        }
        _;
    }

    modifier checkAuctionSeller(uint256 itemId) {
        AuctionItem memory item = _getAuctionItem(itemId);
        if (_msgSender() == item.seller) {
            revert SelfPurchase();
        }
        _;
    }

    modifier checkAuctionBidder(uint256 itemId) {
        if (_auctionItemsHighestBidder[itemId] == address(0)) {
            revert BidderNotFound();
        }
        if (_msgSender() == _auctionItemsHighestBidder[itemId]) {
            revert HighestBidderCanNotRevertFunds();
        }
        _;
    }

    modifier checkAmount(uint256 amount) {
        if (amount <= 0) {
            revert AmountMustBeGreaterThanZero();
        }
        _;
    }

    /**
     * Setting
     */

    function paymentToken() external view returns (IERC20Upgradeable) {
        return _paymentToken;
    }

    function setFeePercent(uint256 newFeePercent) external checkAdmin {
        if (newFeePercent <= 0 || newFeePercent > thousand) {
            revert FeePercentMustBeA1To1000Number();
        }
        _feePercent = newFeePercent;
        
        emit SetFeePercent(_msgSender(), _feePercent);
    }

    function feePercent() external view returns (uint256) {
        return _feePercent;
    }

    function setWhitelist(address nftContract) external checkAdmin {
        if (_whitelistExist[nftContract]) {
            revert AddressExistsInWhitelist();
        }
        _whitelistExist[nftContract] = true;
        _whiteliste.push(nftContract);

        emit SetWhitelist(_msgSender(), nftContract);
    }

    function whitelist() external view returns (address[] memory) {
        return _whiteliste;
    }

    function setBiddingTime(uint time) external checkAdmin {
        _biddingTime = time * 1 days;
    }

    function biddingTime() external view returns (uint) {
        return _biddingTime;
    }

    /**
     * NFTMarketPlace 
     */

    function createMarketItem(
        address nftContract,
        uint256 tokenId,
        uint256 price,
        bool isVegasONE
    ) 
        external 
        checkWhitelist(nftContract) 
        checkAmount(price) 
        returns (uint256)
    {        
        address seller = _msgSender();

        _itemIdCounter.increment();
        uint256 itemId = _itemIdCounter.current();

        _addItem(
            MarketItem({
                itemId: itemId,
                nftContract: nftContract,
                tokenId: tokenId,
                seller: seller,
                isVegasONE: isVegasONE,
                price: price
            })
        );

        emit CreateMarketItem(
            isVegasONE,
            nftContract,
            seller,
            itemId,
            tokenId,
            price
        );

        IERC721Upgradeable(nftContract).safeTransferFrom(
            seller,
            address(this),
            tokenId
        );

        return itemId;
    }

    function removeMarketItem(uint256 itemId) external checkItemExist(itemId){
        MarketItem memory item = _getItem(itemId);
        address seller = _msgSender();
        if (!hasRole(ADMIN_ROLE, seller)){
            if (seller != item.seller) {
                revert OnlyRemovedBySellerOrAdmin();
            }
        }

        _removeItem(item.seller, item.itemId);

        emit RemoveMarketItem(
            item.isVegasONE,
            item.nftContract,
            item.seller,
            item.itemId,
            item.tokenId,
            item.price
        );

        IERC721Upgradeable(item.nftContract).safeTransferFrom(
            address(this),
            item.seller,
            item.tokenId
        );
    }

    function buyE(uint256 itemId) 
        external 
        checkItemExist(itemId) 
        checkSeller(itemId)
        nonReentrant 
        payable 
    {
        MarketItem memory item = _getItem(itemId);

        address buyer = _msgSender();

        if (item.isVegasONE) {
            revert OnlyAcceptEthForPayment();
        }
        require(msg.value == item.price);

        uint256 fee = (item.price * _feePercent) / thousand;
        uint256 realPrice = item.price - fee;

        _totalFeeEth += fee;
        _ownedEth[item.seller] += realPrice;
        
        _removeItem(item.seller, item.itemId);

        emit Buy(
            item.isVegasONE,
            item.nftContract,
            item.seller,
            buyer,
            item.itemId,
            item.tokenId,
            realPrice,
            fee
        );

        IERC721Upgradeable(item.nftContract).safeTransferFrom(
            address(this),
            buyer,
            item.tokenId
        );
    }

    function buyV(uint256 itemId) 
        external 
        checkItemExist(itemId)
        checkSeller(itemId)
        nonReentrant 
    {
        MarketItem memory item = _getItem(itemId);

        address buyer = _msgSender();

        if (!item.isVegasONE) {
            revert OnlyAcceptVegasONEForPayment();
        }

        uint256 fee = (item.price * _feePercent) / thousand;
        uint256 realPrice = item.price - fee;

        _removeItem(item.seller, item.itemId);

        emit Buy(
            item.isVegasONE,
            item.nftContract,
            item.seller,
            buyer,
            item.itemId,
            item.tokenId,
            realPrice,
            fee
        );

        _totalFeeVegasONE += fee;
        _ownedVegasONE[item.seller] += realPrice;
        require(
            _paymentToken.transferFrom(buyer, address(this), item.price), 
            "NFTMarketPlace: transaction failed"
        );

        IERC721Upgradeable(item.nftContract).safeTransferFrom(
            address(this),
            buyer,
            item.tokenId
        );
    }

    function withdrawMPEth(address account, uint256 amount) 
        external
        checkAdmin 
        checkAmount(amount)
        nonReentrant 
    {
        if (amount > _totalFeeEth) {
            revert NotEnoughFunds();
        }
        _totalFeeEth -= amount;
        payable(account).transfer(amount);

        emit WithdrawMP(
            false,
            _msgSender(),
            account,
            amount
        );
    }

    function withdrawMPVegasONE(address account, uint256 amount) 
        external
        checkAdmin 
        checkAmount(amount)
        nonReentrant 
    {
        if (amount > _totalFeeVegasONE) {
            revert NotEnoughFunds();
        }
        _totalFeeVegasONE -= amount;
        require(_paymentToken.transfer(account, amount));
        
        emit WithdrawMP(
            true,
            _msgSender(),
            account,
            amount
        );
    }

    function withdrawEth(address account, uint256 amount) 
        external 
        checkAmount(amount) 
        nonReentrant 
    {
        address buyer = _msgSender();

        if (amount > _ownedEth[buyer]) {
            revert NotEnoughFunds();
        }
        _ownedEth[buyer] -= amount;
        payable(account).transfer(amount);
        

        emit Withdraw(
            false,
            buyer,
            account,
            amount
        );
    }

    function withdrawVegasONE(address account, uint256 amount) 
        external 
        checkAmount(amount) 
        nonReentrant 
    {
        address buyer = _msgSender();

        if (amount > _ownedVegasONE[buyer]) {
            revert NotEnoughFunds();
        }
        _ownedVegasONE[buyer] -= amount;
        require(_paymentToken.transfer(account, amount));

        emit Withdraw(
            true,
            buyer,
            account,
            amount
        );
    }

    function createAuctionItem(
        address nftContract,
        uint256 tokenId,
        bool isVegasONE
    ) 
        external checkWhitelist(nftContract) 
        returns (uint256) 
    {        
        address seller = _msgSender();

        _auctionItemsIdCounter.increment();
        uint256 itemId = _auctionItemsIdCounter.current();

        uint auctionStartTime = block.timestamp;
        address highestBidder = address(0);
        uint256 highestPrice = 0;

        _addAuctionItem(
            AuctionItem({
                itemId: itemId,
                nftContract: nftContract,
                tokenId: tokenId,
                seller: seller,
                isVegasONE: isVegasONE,
                auctionStartTime: auctionStartTime,
                highestBidder: highestBidder,
                highestPrice: highestPrice
            })
        );

        emit CreateAuctionItem(
            isVegasONE,
            nftContract,
            seller,
            auctionStartTime,
            itemId,
            tokenId,
            highestPrice
        );

        IERC721Upgradeable(nftContract).safeTransferFrom(
            seller,
            address(this),
            tokenId
        );

        return itemId;
    }

    function removeAuctionItem(uint256 itemId) 
        external 
        checkAuctionItemExist(itemId)
    {
        AuctionItem memory item = _getAuctionItem(itemId);
        address seller = _msgSender();
        if (!hasRole(ADMIN_ROLE, seller)){
            if (seller != item.seller) {
                revert OnlyRemovedBySellerOrAdmin();
            }
        }
        
        if (item.highestBidder != address(0)) {
            revert CanNotRemovedWhenHighestBidderExist();
        }

        _removeAuctionItem(item.seller, item.itemId);

        emit RemoveAuctionItem(
            item.isVegasONE,
            item.nftContract,
            item.seller,
            item.auctionStartTime,
            item.itemId,
            item.tokenId,
            item.highestPrice
        ); 

        IERC721Upgradeable(item.nftContract).safeTransferFrom(
            address(this),
            item.seller,
            item.tokenId
        );
    }

    function bidV(uint256 itemId, uint256 price)
        external 
        checkAuctionItemExist(itemId) 
        checkAuctionSeller(itemId)
        nonReentrant 
    {
        AuctionItem storage item = _getAuctionItem(itemId);
        
        address buyer = _msgSender();

        if (block.timestamp >= item.auctionStartTime + _biddingTime) {
            revert AuctionIsOver();
        }

        if (!item.isVegasONE) {
            revert OnlyAcceptVegasONEForPayment();
        }

        if (buyer == item.highestBidder) {
            revert HighestBidderIsYou();
        }

        if (_ownedBidVegasONE[buyer][item.itemId] + price <= item.highestPrice) {
            revert NotExceedingHighestPrice();
        }

        _auctionItemsHighestBidder[item.itemId] = buyer;
        item.highestPrice = _ownedBidVegasONE[buyer][item.itemId] + price;
        item.highestBidder = buyer;

        _ownedBidVegasONE[item.highestBidder][item.itemId] = item.highestPrice;
        
        require(
            _paymentToken.transferFrom(buyer, address(this), price), 
            "NFTMarketPlace: transaction failed"
        );

        emit Bid(
            item.isVegasONE,
            item.nftContract,
            item.seller,
            buyer,
            item.itemId,
            item.tokenId,
            price
        );
    }

    function bidE(uint256 itemId) 
        external 
        checkAuctionItemExist(itemId) 
        checkAuctionSeller(itemId)
        nonReentrant
        payable
    {
        AuctionItem storage item = _getAuctionItem(itemId);
        
        address buyer = _msgSender();

        if (block.timestamp >= item.auctionStartTime + _biddingTime) {
            revert AuctionIsOver();
        }
        
        if (item.isVegasONE) {
            revert OnlyAcceptEthForPayment();
        }

        if (buyer == item.highestBidder) {
            revert HighestBidderIsYou();
        }

        if (_ownedBidEth[buyer][item.itemId] + msg.value <= item.highestPrice) {
            revert NotExceedingHighestPrice();
        }

        _auctionItemsHighestBidder[item.itemId] = buyer;
        item.highestPrice = _ownedBidEth[buyer][item.itemId] + msg.value;
        item.highestBidder = buyer;

        _ownedBidEth[item.highestBidder][item.itemId] = item.highestPrice;

        emit Bid(
            item.isVegasONE,
            item.nftContract,
            item.seller,
            buyer,
            item.itemId,
            item.tokenId,
            msg.value
        );
    }

    function revertBidVegasONE(address account, uint256 itemId) 
        external 
        checkAuctionBidder(itemId) 
        nonReentrant
    {
        address buyer = _msgSender();
        uint256 _balance = _ownedBidVegasONE[buyer][itemId];

        if (_balance == 0) {
            revert NoFundsCanBeRevert();
        }

        _ownedBidVegasONE[buyer][itemId] = 0;
        require(_paymentToken.transfer(account, _balance));

        emit RevertBid(
            buyer,
            account,
            itemId,
            _balance
        );
    }

    function revertBidEth(address account,uint256 itemId) 
        external 
        checkAuctionBidder(itemId) 
        nonReentrant 
    {
        address buyer = _msgSender();
        uint256 _balance = _ownedBidEth[buyer][itemId];

        if (_balance == 0) {
            revert NoFundsCanBeRevert();
        }

        _ownedBidEth[buyer][itemId] = 0;
        payable(account).transfer(_balance);

        emit RevertBid(
            buyer,
            account,
            itemId,
            _balance
        );
    }

    function auctionEnd(uint256 itemId) external nonReentrant checkAuctionItemExist(itemId) {
        AuctionItem memory item = _getAuctionItem(itemId);

        if (block.timestamp < item.auctionStartTime + _biddingTime) {
            revert AuctionIsNotOver();
        }

        if (item.highestBidder == address(0)) {
            revert NoOneBid();
        }

        if ((_msgSender() != item.highestBidder && _msgSender() != item.seller)) {
            revert OnlyHighestBidderOrSellerCanEnd();
        }

        uint256 fee = (item.highestPrice * _feePercent) / thousand;
        uint256 realPrice = item.highestPrice - fee;

        _removeAuctionItem(item.seller, item.itemId);

        if (item.isVegasONE)
        {   
            _totalFeeVegasONE += fee;
            _ownedBidVegasONE[item.highestBidder][item.itemId] = 0;
            require(_paymentToken.transfer(item.seller, realPrice));
        } else {
            _totalFeeEth += fee;
            _ownedBidEth[item.highestBidder][item.itemId] = 0;
            payable(item.seller).transfer(realPrice);
        }

        emit AuctionEnd(
            item.isVegasONE,
            item.nftContract,
            item.seller,
            item.highestBidder,
            item.auctionStartTime + _biddingTime,
            item.itemId,
            item.tokenId,
            realPrice,
            fee
        );

        IERC721Upgradeable(item.nftContract).safeTransferFrom(
            address(this),
            item.highestBidder,
            item.tokenId
        );
    }

    function getMarketItem(uint256 itemId)
        external
        view
        returns (MarketItem memory)
    {
        return _getItem(itemId);
    }

    function listMarketItem(uint256 perPage, uint256 pageId) 
        external 
        view 
        returns (MarketItem[] memory) 
    {
        uint256 counter = _items.length;
        uint256 idCounter = perPage * (pageId - 1) + 1;

        MarketItem[] memory ret = new MarketItem[](perPage);

        for (uint256 i = 0; i < perPage; i++) {
            if (idCounter <= counter) {
                ret[i] = _getItem(idCounter);
                idCounter++;
            }
        }
        return ret;
    }

    function listMarketItemOf(address seller, uint256 perPage, uint256 pageId)
        external
        view
        returns (MarketItem[] memory)
    {
        uint256 counter = _ownedItems[seller].length;
        uint256 idCounter = (perPage * (pageId - 1));

        MarketItem[] memory ret = new MarketItem[](perPage);

        for (uint256 i = 0; i < perPage; i++) {
            if (idCounter < counter) {
                uint256 itemId = _ownedItems[seller][idCounter];
                ret[i] = _getItem(itemId);
                idCounter++;
            }
        }
        return ret;
    }

    function marketItemCountOf(address seller) external view returns (uint256) {
        return _ownedItems[seller].length;
    }

    function marketItemCount() external view returns (uint256) {
        return _items.length;
    }
    
    function getAuctionItem(uint256 itemId)
        external
        checkAuctionItemExist(itemId)
        view
        returns (AuctionItem memory)
    {
        return _getAuctionItem(itemId);
    }

    function listAuctionItem(uint256 perPage, uint256 pageId) 
        external 
        view 
        returns (AuctionItem[] memory)
    {
        uint256 counter = _auctionItems.length;
        uint256 idCounter = perPage * (pageId - 1) + 1;

        AuctionItem[] memory ret = new AuctionItem[](perPage);

        for (uint256 i = 0; i < perPage; i++) {
            if (idCounter <= counter) {
                ret[i] = _getAuctionItem(idCounter);
                idCounter++;
            }
        }
        return ret;
    }

    function listAuctionItemOf(address seller, uint256 perPage, uint256 pageId)
        external
        view
        returns (AuctionItem[] memory)
    {
        uint256 counter = _ownedAuctionItems[seller].length;
        uint256 idCounter = (perPage * (pageId - 1));

        AuctionItem[] memory ret = new AuctionItem[](perPage);

        for (uint256 i = 0; i < perPage; i++) {
            if (idCounter < counter) {
                uint256 itemId = _ownedAuctionItems[seller][idCounter];
                ret[i] = _getAuctionItem(itemId);
                idCounter++;
            }
        }
        return ret;
    }

    function auctionItemCountOf(address seller) external view returns (uint256) {
        return _ownedAuctionItems[seller].length;
    }

    function auctionItemCount() external view returns (uint256) {
        return _auctionItems.length;
    }

    function drawableMPEth() external checkAdmin view returns (uint256) {
        return _totalFeeEth;
    }

    function drawableMPVegasONE() external checkAdmin view returns (uint256) {
        return _totalFeeVegasONE;
    }

    function drawableEth() external view returns (uint256) {
        return _ownedEth[_msgSender()];
    }

    function drawableVegasONE() external view returns (uint256) {
        return _ownedVegasONE[_msgSender()];
    }

    function revertableEth(uint256 itemId) external view returns (uint256) {
        return _ownedBidEth[_msgSender()][itemId];
    }

    function revertableVegasONE(uint256 itemId) external view returns (uint256) {
        return _ownedBidVegasONE[_msgSender()][itemId];
    }

    function _isItemExist(uint256 itemId) internal view returns (bool) {
        return _itemsExist[itemId];
    }

    function _getItem(uint256 itemId)
        internal
        view
        returns (MarketItem storage)
    {
        uint256 index = _itemsIndex[itemId];
        return _items[index];
    }

    function _addItem(MarketItem memory newItem) internal {
        _itemsExist[newItem.itemId] = true;
        _addMainItem(newItem);
        _addOwnedItem(newItem.seller, newItem.itemId);
    }

    function _removeItem(address seller, uint256 itemId) internal {
        _removeOwnedItem(seller, itemId);
        _removeMainItem(itemId);
        delete _itemsExist[itemId];
    }

    function _addMainItem(MarketItem memory newItem) internal {
        uint256 newIndex = _items.length;
        _items.push(newItem);
        _itemsIndex[newItem.itemId] = newIndex;
    }

    function _addOwnedItem(address seller, uint256 newItemId) internal {
        uint256 newIndex = _ownedItems[seller].length;
        _ownedItems[seller].push(newItemId);
        _ownedItemsIndex[newItemId] = newIndex;
    }

    function _removeMainItem(uint256 itemId) internal {
        uint256 targetIndex = _itemsIndex[itemId];
        uint256 lastIndex = _items.length - 1;

        if (targetIndex != lastIndex) {
            MarketItem storage lastItem = _items[lastIndex];
            _items[targetIndex] = lastItem;
            _itemsIndex[lastItem.itemId] = targetIndex;
        }

        delete _itemsIndex[itemId];
        _items.pop();
    }

    function _removeOwnedItem(address seller, uint256 itemId) internal {
        uint256 targetIndex = _ownedItemsIndex[itemId];
        uint256 lastIndex = _ownedItems[seller].length - 1;

        if (targetIndex != lastIndex) {
            uint256 lastItemId = _ownedItems[seller][lastIndex];
            _ownedItems[seller][targetIndex] = lastItemId;
            _ownedItemsIndex[lastItemId] = targetIndex;
        }

        delete _ownedItemsIndex[itemId];
        _ownedItems[seller].pop();
    }

    function _isAuctionItemExist(uint256 itemId) internal view returns (bool) {
        return _auctionItemsExist[itemId];
    }

    function _getAuctionItem(uint256 itemId)
        internal
        view
        returns (AuctionItem storage)
    {
        uint256 index = _auctionItemsIndex[itemId];
        return _auctionItems[index];
    }

    function _addAuctionItem(AuctionItem memory newItem) internal {
        _auctionItemsExist[newItem.itemId] = true;
        _addMainAuctionItem(newItem);
        _addOwnedAuctionItem(newItem.seller, newItem.itemId);
    }

    function _removeAuctionItem(address seller, uint256 itemId) internal {
        _removeOwnedAuctionItem(seller, itemId);
        _removeMainAuctionItem(itemId);
        delete _auctionItemsExist[itemId];
    }

    function _addMainAuctionItem(AuctionItem memory newItem) internal {
        uint256 newIndex = _auctionItems.length;
        _auctionItems.push(newItem);
        _auctionItemsIndex[newItem.itemId] = newIndex;
    }

    function _addOwnedAuctionItem(address seller, uint256 newItemId) internal {
        uint256 newIndex = _ownedAuctionItems[seller].length;
        _ownedAuctionItems[seller].push(newItemId);
        _ownedAuctionItemsIndex[newItemId] = newIndex;
    }

    function _removeMainAuctionItem(uint256 itemId) internal {
        uint256 targetIndex = _auctionItemsIndex[itemId];
        uint256 lastIndex = _auctionItems.length - 1;

        if (targetIndex != lastIndex) {
            AuctionItem storage lastItem = _auctionItems[lastIndex];
            _auctionItems[targetIndex] = lastItem;
            _auctionItemsIndex[lastItem.itemId] = targetIndex;
        }

        delete _auctionItemsIndex[itemId];
        _auctionItems.pop();
    }

    function _removeOwnedAuctionItem(address seller, uint256 itemId) internal {
        uint256 targetIndex = _ownedAuctionItemsIndex[itemId];
        uint256 lastIndex = _ownedAuctionItems[seller].length - 1;

        if (targetIndex != lastIndex) {
            uint256 lastItemId = _ownedAuctionItems[seller][lastIndex];
            _ownedAuctionItems[seller][targetIndex] = lastItemId;
            _ownedAuctionItemsIndex[lastItemId] = targetIndex;
        }

        delete _ownedAuctionItemsIndex[itemId];
        _ownedAuctionItems[seller].pop();
    }

    function _isWhitelist(address nftContract) internal view returns (bool) {
        return _whitelistExist[nftContract];
    }

    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        onlyRole(DEFAULT_ADMIN_ROLE)
        override
    {}

    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}