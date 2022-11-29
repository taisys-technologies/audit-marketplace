# Audit Marketplace

## Change record

- feat: add marketitemcount & auctionitemcount (#1)

> - Add marketItemCount and auctionItemCount functions.

- feat: add code comment (#3)

> - Add code comments.

- Feature/marketplace (#4)

> - Add zero address check, sold out check and out of bounds check.
> - Add soldOut field into MarketItem and AuctionItem struct.
> - Descending all list functions.
> - The remove-related functions now sets soldOut field to true instead of delete items permanently.

<br />

## Overview

The purpose of this contract is to provide a platform where NFTs of whitelisted contracts can be listed for sale and NFT auctions.

Currently, ETH and VEGASONE are supported currencies for transactions.

For each successfully executed transactions, a specified percentage cut is taken for the sale amount.

The following are explanations for some user scenarios and the contract functions.

<br />

## Contract Scenario Description

- Listing process

Only NFTs of whitelisted contracts can be listed as a market item; only the item seller or administrators can cancel the sale.
The relative methods are `createMarketItem`, `createAuctionItem`, `removeMarketItem`, and `removeAuctionItem`.

<br />

- Buying Process

To buy a listed item, buyers need to pay attention to the currency type of the item.
The NFT will be transferred from the contract to the buyer as the fee will be transferred from the buyer to the contract. The fee will then be kept in the contract for the seller to reclaim it.

The relative methods are `buyE`, `buyV`, `withdrawEth`, and `withdrawVegasONE`.

<br />

- Auction Process

Auction items lasts for a number of days set by the administrator from the time of listing. Bidders must pay attention to the currency of the bidding items.

After the auction time expires, the seller or the highest bidder can end the auction. A cut for the handling fee is taken from the deal. The NFT and the remaining fee are kept in the contract for the seller and the highest bidder to reclaim later.

Funds from non-highest bidders can then be withdrawn.

The relative methods are `auctionEnd`, `bidE`, `bidV`, `withdrawEth`, `withdrawVegasONE`, `revertBidEth`, and `revertBidVegasONE`.

<br />

## Function Description

- auctionEnd

After the auction time expires, this function can be executed by the seller or the highest bidder to move on to the subsequent transaction procedures.

<br />

- bidE

For auction items.
Bidders enter the itemId of the auction item and bid with Eth as the transaction currency.
If the bidder has already bid on the same item, increase the bid on top of the previous bid.

<br />

- bidV

For auction items.
Bidders enter the itemId of the auction item and bid with VegasONE as the transaction currency.
If the bidder has already bid on the same item, increase the bid on top of the previous bid.

<br />

- buyE

For market item.
Buyers need to enter the itemId of the market item to buy the item with Eth as payment.

<br />

- buyV

For market item.
Buyers need to enter the itemId of the market item to buy the item with VegasONE as payment.

<br />

- createAuctionItem

To create an auction item, a seller needs to assign the NFT contract address, the NFT tokenId, and a transactional currency (either Eth or VegasONE). The auction will last for a number of days set by the administrator.

<br />

- createMarketItem

To create a market item, a seller needs to assign the NFT contract address, the NFT tokenId, a desirable selling price, and a transactional currency (either Eth or VegasONE).

<br />

- removeAuctionItem

For sellers and administrators only, available when no one bids.
Enter itemId to cancel the auction item.

<br />

- removeMarketItem

For sellers and administrators only.
Enter itemId to cancel the market item.

<br />

- revertBidEth

For non-highest bidders only, withdraw the caller's bidding Eth amount for the auction item to the assigned address.

<br />

- revertBidVegasONE

For non-highest bidders only, withdraw the caller's bidding VegasONE amount for the auction item to the assigned address.

<br />

- withdrawEth

Withdraws the caller's Eth balance within the contract to the assigned address.

<br />

- withdrawVegasONE

Withdraws the caller's VegasONE balance within the contract to the assigned address.

<br />

- setBiddingTime **onlyAdmin**

Sets the auction duration.

<br />

- setFeePercent **onlyAdmin**

Sets the transaction fee percentage.

<br />

- setWhitelist **onlyAdmin**

Adds a trusted NFT contract to the whitelist.

<br />

- withdrawMPEth **onlyAdmin**

Withdraws the Eth net profit within the contract to the assigned address.

<br />

- withdrawMPVegasONE **onlyAdmin**

Withdraws the VegasONE net profit balance within the contract to the assigned address.

## Document

- [Notion](https://nonstop-krypton-90d.notion.site/Taisys-MarketPlace-de62136794df4d4b8bbe14708e508fa2)
- [Audit Report](./audit/)

## Test

### Setup

```bash
npm install
```

### Run

```bash
# run all tests
npx hardhat test

# run single test
npx hardhat test ${TEST_FILE_PATH}

# run tests with coverage report
npx hardhat coverage
```

## Static Analysis

- [Slither Github](https://github.com/crytic/slither)

```bash
slither .
```
