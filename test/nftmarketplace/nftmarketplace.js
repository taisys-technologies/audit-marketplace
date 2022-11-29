const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { network } = require("hardhat");

describe("NFTMarketPlace", function() {
    let nftMarketPlace;
    let developer;
    let VegasONE;
    let owner;
    let signer1;
    let signer2;
    let signer3;
    let signer4;
    let signer5;
    let signers;
    let price = ethers.utils.parseEther("1");

    const getNow = async function () {
        let latestBlockNumber = await ethers.provider.getBlockNumber();
        let latestBlock = await ethers.provider.getBlock(latestBlockNumber);
        const now = ethers.BigNumber.from(Date.now()).div(1e3);
        return now > latestBlock.timestamp ? now : latestBlock.timestamp;
    };

    beforeEach(async function() {
        let developerFactory = await ethers.getContractFactory("DeveloperNFT");
        let VegasONEFactory = await ethers.getContractFactory("VegasONE");
        let NFTnftMarketPlaceFactory = await ethers.getContractFactory("NFTMarketPlace");

        [owner, signer1, signer2, signer3, signer4, signer5,...signers] = await ethers.getSigners();

        // deploy VegasONE(ERC20)
        VegasONE = await VegasONEFactory.deploy(
            "VegasONE",
            "VOC",
            ethers.utils.parseEther("100")
        );
        await VegasONE.deployed();
  
        // deploy developer, signer1 as backend address
        developer = await upgrades.deployProxy(
            developerFactory,
            ["tn", "ts", 100, signer1.address, VegasONE.address, price],
            { kind: "uups" }
        );
        await developer.deployed();

        nftMarketPlace = await upgrades.deployProxy(
            NFTnftMarketPlaceFactory,
            [VegasONE.address, 30, 7],
            { kind: "uups" }
        );
        await nftMarketPlace.deployed();

        // set period token supply
        const setPeriodTokenSupply = await developer.setPeriodTokenSupply(50);
        await setPeriodTokenSupply.wait();

        // mint VegasONE to signer2, signer3, signer4
        const amount = ethers.utils.parseEther("10");
        await VegasONE.mint(signer2.address, amount);
        await VegasONE.mint(signer3.address, amount);
        await VegasONE.mint(signer4.address, amount);
        await VegasONE.mint(signer5.address, amount);

        // generate uuid
        let uuid = "uuid";
        // generate deadline: after 7 days
        let today = getNow();
        let deadline = await today + (60 * 60 * 24 * 7);

        // get userAddress (signer2 as user)
        let userAddress = signer2.address;
        let uri =
            "https://www.taisys.dev/ipfs/QmU2Xc2xoD9rwTgXhkrB3C354U4F6rmL1RRqoGV4L8axSX";

        const domain = {
            name: "tn",
            version: "1",
            chainId: 31337,
            verifyingContract: developer.address,
        };

        const types = {
            CheckToken: [
                { name: "uuid", type: "string" },
                { name: "userAddress", type: "address" },
                { name: "deadline", type: "uint256" },
                { name: "uri", type: "string" },
            ],
        };

        const value = {
            uuid: uuid,
            userAddress: userAddress,
            deadline: deadline,
            uri: uri,
        };

        // backend signed signature
        const signature = await signer1._signTypedData(domain, types, value);

        let approvalTx = await VegasONE.connect(signer2).approve(
            developer.address,
            price
        );
        
        await approvalTx.wait();

        let tx = await developer
        .connect(signer2)
        .checkTokenAndMint(uuid, userAddress, deadline, uri, signature);

        await tx.wait();

        const approveTx1 = await developer
        .connect(signer2)
        .approve(nftMarketPlace.address, 0);
        await approveTx1.wait();

        // generate uuid
        uuid = "uuid2";

        // get userAddress (signer3 as user)
        userAddress = signer3.address;
        uri =
            "https://www.taisys.dev/ipfs/QmU2Xc2xoD9rwTgXhkrB3C354U4F6rmL1RRqoGV4L8axS1";

        const domain2 = {
            name: "tn",
            version: "1",
            chainId: 31337,
            verifyingContract: developer.address,
        };

        const types2 = {
            CheckToken: [
                { name: "uuid", type: "string" },
                { name: "userAddress", type: "address" },
                { name: "deadline", type: "uint256" },
                { name: "uri", type: "string" },
            ],
        };

        const value2 = {
            uuid: uuid,
            userAddress: userAddress,
            deadline: deadline,
            uri: uri,
        };

        // backend signed signature
        const signature2 = await signer1._signTypedData(domain2, types2, value2);

        let approvalTx2 = await VegasONE.connect(signer3).approve(
            developer.address,
            price
        );
        
        await approvalTx2.wait();

        tx = await developer
        .connect(signer3)
        .checkTokenAndMint(uuid, userAddress, deadline, uri, signature2);

        await tx.wait();

        approveTx2 = await developer
        .connect(signer3)
        .approve(nftMarketPlace.address, 1);
        await approveTx1.wait();

        let tx1 = await nftMarketPlace.setWhitelist(developer.address);
        await tx1.wait();        
    });

    describe("createMarketItem", function () {
        it("Positive", async function () {
            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, 1, true);
            await tx.wait();

            const itemCount = await nftMarketPlace.marketItemCountOf(signer2.address);
            expect(itemCount).to.equal(1);
        })
        it("Negative/nftContractNotInWhitelist", async function () {
            let tx = nftMarketPlace.connect(signer2).createMarketItem(VegasONE.address, 0, 1, true);
            await expect(tx).to.be.revertedWith("AddressNotInWhitelist");
        })
        it("Negative/priceCannotBeLessThanZERO", async function () {
            let tx = nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, 0, true);
            await expect(tx).to.be.revertedWith("AmountMustBeGreaterThanZero");
        })
    });

    describe("listMarketItem", function (){
        it("Positive", async function (){
            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, 1, true);
            await tx.wait();

            tx = await nftMarketPlace.connect(signer3).createMarketItem(developer.address, 1, 2, true);
            await tx.wait();

            tx = await nftMarketPlace.listMarketItem(5, 1);
            expect(tx[0].itemId).to.equal(2);
            expect(tx[0].seller).to.equal(signer3.address);
            expect(tx[1].itemId).to.equal(1);
            expect(tx[1].seller).to.equal(signer2.address);
        })
        it("Negative/outOfBounds", async function () {
            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, 1, true);
            await tx.wait();

            tx = nftMarketPlace.listMarketItem(1,2);
            await expect(tx).to.be.revertedWith("OutOfBounds");
        })
    })

    describe("listMarketItemOf", function (){
        it("Positive", async function (){
            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, 1, true);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).createMarketItem(developer.address, 1, 2, true);
            await tx.wait();
            
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, price);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).buyV(1);
            await tx.wait();

            tx = await developer.connect(signer3).approve(nftMarketPlace.address, 0);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).createMarketItem(developer.address, 0, 4, true);
            await tx.wait();

            tx = await nftMarketPlace.listMarketItemOf(signer3.address, 3, 1);
            expect(tx[0].itemId).to.equal(3);
            expect(tx[0].price).to.equal(4);
            expect(tx[1].itemId).to.equal(2);
            expect(tx[1].price).to.equal(2);
        })
        it("Negative/outOfBounds", async function () {
            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, 1, true);
            await tx.wait();

            tx = nftMarketPlace.listMarketItemOf(signer2.address, 1, 2);
            await expect(tx).to.be.revertedWith("OutOfBounds");
        })
    })

    describe("removeMarketItem", function () {
        it("Positive", async function () {
            let tx = await nftMarketPlace.grantRole(nftMarketPlace.ADMIN_ROLE(), signer3.address);
            await tx.wait();

            tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, 1, true);
            await tx.wait();
            
            tx = await nftMarketPlace.connect(signer2).removeMarketItem(1);
            await tx.wait();

            tx = await nftMarketPlace.getMarketItem(1);
            expect(await tx.soldOut).to.equal(true);
        })
        it("Negative/itemNotExist", async function (){
            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, 1, true);
            await tx.wait();
            
            tx = nftMarketPlace.connect(signer2).removeMarketItem(2);
            await expect(tx).to.be.revertedWith("MarketItemNotFound");
        })
        it("Negative/notRemovedBySeller", async function (){
            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, 1, true);
            await tx.wait();
            
            tx = nftMarketPlace.connect(signer3).removeMarketItem(1);
            await expect(tx).to.be.revertedWith("OnlyRemovedBySellerOrAdmin");
        })
    });

    describe("buyE", function () {
        it("Positive", async function () {
            const balance = await signer3.getBalance();
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, price, false);
            await tx.wait();
            
            tx = await nftMarketPlace.connect(signer3).buyE(1, {value: price});
            const tx1 = await tx.wait();

            const gasFee = tx1.gasUsed.mul(tx1.effectiveGasPrice);
            const sellerB = await nftMarketPlace.connect(signer2).drawableEth();
            const nftMarketPlaceB = await nftMarketPlace.drawableMPEth();

            expect(price).to.equal(sellerB.add(nftMarketPlaceB));
            const aftB = await signer3.getBalance();
            expect(aftB).to.equal(balance.sub(price).sub(gasFee));
        })
        it("Negative/itemNotExist",async function (){
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, 1, false);
            await tx.wait();
            
            tx = nftMarketPlace.connect(signer3).buyE(2, {value: price});
            await expect(tx).to.be.revertedWith("MarketItemNotFound");
        })
        it("Negative/self-purchase",async function (){
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, 1, false);
            await tx.wait();
            
            tx = nftMarketPlace.connect(signer2).buyE(1, {value: price});
            await expect(tx).to.be.revertedWith("SelfPurchase");
        })
        it("Negative/purchaseWithVegasONE",async function (){
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, 1, true);
            await tx.wait();
            
            tx = nftMarketPlace.connect(signer3).buyE(1, {value: price});
            await expect(tx).to.be.revertedWith("OnlyAcceptEthForPayment");
        })
    });

    describe("buyV", function () {
        it("Positive", async function () {
            const balance = await VegasONE.balanceOf(signer3.address);
            
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, price, true);
            await tx.wait();
            
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, price);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).buyV(1);
            await tx.wait();

            const sellerB = await nftMarketPlace.connect(signer2).drawableVegasONE();
            const nftMarketPlaceB = await nftMarketPlace.drawableMPVegasONE();

            expect(price).to.equal(sellerB.add(nftMarketPlaceB));
            const aftB = await VegasONE.balanceOf(signer3.address);
            expect(aftB).to.equal(balance.sub(price));
        })
        it("Negative/itemNotExist",async function (){
            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, 1, true);
            await tx.wait();
            
            tx = nftMarketPlace.connect(signer3).buyV(2);
            await expect(tx).to.be.revertedWith("MarketItemNotFound");
        })
        it("Negative/self-purchase",async function (){
            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, 1, true);
            await tx.wait();
            
            tx = nftMarketPlace.connect(signer2).buyV(1);
            await expect(tx).to.be.revertedWith("SelfPurchase");
        })
        it("Negative/purchaseWithEth",async function (){
            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, 1, false);
            await tx.wait();
            
            tx = nftMarketPlace.connect(signer3).buyV(1);
            await expect(tx).to.be.revertedWith("OnlyAcceptVegasONEForPayment");
        })
    });

    describe("withdrawMP", function (){
        it("Positive/Eth", async function (){
            let tx = await nftMarketPlace.grantRole(nftMarketPlace.ADMIN_ROLE(), signer2.address);
            await tx.wait();
            const price = ethers.utils.parseEther("1");

            tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, price, false);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).buyE(1, {value: price});
            await tx.wait();

            let balance = await nftMarketPlace.connect(signer2).drawableMPEth();
            let sellerB = await signer2.getBalance();
            sellerB = sellerB.add(balance);
            
            tx = await nftMarketPlace.connect(signer2).withdrawMPEth(signer2.address, balance);
            let tx1 = await tx.wait();
            let gasFee = await tx1.gasUsed.mul(tx1.effectiveGasPrice);

            sellerB2 = await signer2.getBalance();
            sellerB2 = sellerB2.add(gasFee);
            expect(sellerB2).to.equal(sellerB);

            balance = await nftMarketPlace.connect(signer2).drawableMPEth();
            expect(balance).to.equal(0);
        })
        it("Negative/Eth/zeroAddress", async function (){
            let tx = await nftMarketPlace.grantRole(nftMarketPlace.ADMIN_ROLE(), signer2.address);
            await tx.wait();
            const price = ethers.utils.parseEther("1");

            tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, price, false);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).buyE(1, {value: price});
            await tx.wait();
            
            let balance = await nftMarketPlace.connect(signer2).drawableMPEth();
            tx = nftMarketPlace.connect(signer2).withdrawMPEth("0x0000000000000000000000000000000000000000", balance);
            await expect(tx).to.be.revertedWith("ZeroAddress");
        })
        it("Negative/Eth/notEnoughFunds", async function(){
            let tx = await nftMarketPlace.grantRole(nftMarketPlace.ADMIN_ROLE(), signer2.address);
            await tx.wait();
            const price = ethers.utils.parseEther("1");

            tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, price, false);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).buyE(1, {value: price});
            await tx.wait();
            
            let balance = await nftMarketPlace.connect(signer2).drawableMPEth();
            tx = nftMarketPlace.connect(signer2).withdrawMPEth(signer2.address, balance.add(1));
            await expect(tx).to.be.revertedWith("NotEnoughFunds")
        })
        it("Positive/VegasONE", async function (){
            let tx = await nftMarketPlace.grantRole(nftMarketPlace.ADMIN_ROLE(), signer2.address);
            const price = ethers.utils.parseEther("1");

            tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, price, true);
            await tx.wait();
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, price);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).buyV(1);
            await tx.wait();

            let sellerB = await VegasONE.balanceOf(signer2.address);
            let balance = await nftMarketPlace.connect(signer2).drawableMPVegasONE();
            sellerB = sellerB.add(balance);

            tx = await nftMarketPlace.connect(signer2).withdrawMPVegasONE(signer2.address, balance);
            await tx.wait();
            
            let sellerB2 = await VegasONE.balanceOf(signer2.address);
            expect(sellerB2).to.equal(sellerB);
            balance = await nftMarketPlace.connect(signer2).drawableMPVegasONE();
            expect(balance).to.equal(0);
        })
        it("Negative/VegasONE/zeroAddress", async function (){
            let tx = await nftMarketPlace.grantRole(nftMarketPlace.ADMIN_ROLE(), signer2.address);
            const price = ethers.utils.parseEther("1");

            tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, price, true);
            await tx.wait();
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, price);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).buyV(1);
            await tx.wait();

            let balance = await nftMarketPlace.connect(signer2).drawableMPVegasONE();
            tx = nftMarketPlace.connect(signer2).withdrawMPVegasONE("0x0000000000000000000000000000000000000000", balance);
            await expect(tx).to.be.revertedWith("ZeroAddress");
        })
        it("Negative/VegasONE/notEnoughFunds",async function (){
            let tx = await nftMarketPlace.grantRole(nftMarketPlace.ADMIN_ROLE(), signer2.address);
            const price = ethers.utils.parseEther("1");

            tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, price, true);
            await tx.wait();
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, price);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).buyV(1);
            await tx.wait();

            let balance = await nftMarketPlace.connect(signer2).drawableMPVegasONE();
            tx = nftMarketPlace.connect(signer2).withdrawMPVegasONE(signer2.address, balance.add(1));
            await expect(tx).to.be.revertedWith("NotEnoughFunds")
        })
    });

    describe("withdraw", function (){
        it("Positive/Eth", async function (){
            let balance = await signer2.getBalance();
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, price, false);
            let tx1 = await tx.wait();
            const gas = tx1.gasUsed.mul(tx1.effectiveGasPrice);
            balance = balance.sub(gas);

            tx = await nftMarketPlace.connect(signer3).buyE(1, {value: price});
            await tx.wait();

            const sellerB = await nftMarketPlace.connect(signer2).drawableEth();            
            tx = await nftMarketPlace.connect(signer2).withdrawEth(signer2.address, sellerB);
            tx1 = await tx.wait();
            const gas2 = tx1.gasUsed.mul(tx1.effectiveGasPrice);
            balance = balance.add(sellerB);
            balance = balance.sub(gas2);

            const sellerB2 = await nftMarketPlace.connect(signer2).drawableEth();
            expect(0).to.equal(sellerB2);

            const sellerEth = await signer2.getBalance();
            expect(sellerEth).to.equal(balance);
        })
        it("Negative/Eth/zeroAddress", async function (){
            const price = ethers.utils.parseEther("1");

            tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, price, false);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).buyE(1, {value: price});
            await tx.wait();
            
            let balance = await nftMarketPlace.connect(signer2).drawableEth();
            tx = nftMarketPlace.connect(signer2).withdrawEth("0x0000000000000000000000000000000000000000", balance);
            await expect(tx).to.be.revertedWith("ZeroAddress");
        })
        it("Negative/Eth/notEnoughFunds", async function (){
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, price, false);
            await tx.wait();

            tx = await nftMarketPlace.connect(signer3).buyE(1, {value: price});
            await tx.wait();

            const sellerB = await nftMarketPlace.connect(signer2).drawableEth();            
            tx = nftMarketPlace.connect(signer2).withdrawEth(signer2.address, sellerB.add(1));
            await expect(tx).to.be.revertedWith("NotEnoughFunds");
        })
        it("Positive/VegasONE", async function (){
            let balance = await VegasONE.balanceOf(signer2.address);
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, price, true);
            await tx.wait();
            
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, price);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).buyV(1);
            await tx.wait();

            let sellerB = await nftMarketPlace.connect(signer2).drawableVegasONE();
            tx = await nftMarketPlace.connect(signer2).withdrawVegasONE(signer2.address, sellerB);
            await tx.wait();
            balance = balance.add(sellerB);

            sellerB = await nftMarketPlace.connect(signer2).drawableVegasONE();
            expect(0).to.equal(sellerB);
            balance = await VegasONE.balanceOf(signer2.address);
            expect(balance).to.equal(balance);
        })
        it("Negative/VegasONE/zeroAddress", async function (){
            const price = ethers.utils.parseEther("1");

            tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, price, true);
            await tx.wait();
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, price);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).buyV(1);
            await tx.wait();

            let balance = await nftMarketPlace.connect(signer2).drawableVegasONE();
            tx = nftMarketPlace.connect(signer2).withdrawVegasONE("0x0000000000000000000000000000000000000000", balance);
            await expect(tx).to.be.revertedWith("ZeroAddress");
        })
        it("Negative/VegasONE/notEnoughFunds", async function (){
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createMarketItem(developer.address, 0, price, true);
            await tx.wait();
            
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, price);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).buyV(1);
            await tx.wait();

            let sellerB = await nftMarketPlace.connect(signer2).drawableVegasONE();
            tx = nftMarketPlace.connect(signer2).withdrawVegasONE(signer2.address, sellerB.add(1));
            await expect(tx).to.be.revertedWith("NotEnoughFunds")
        })
    });

    describe("createAuctionItem", function (){
        it("Positive", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();
            
            const itemCount = await nftMarketPlace.auctionItemCountOf(signer2.address);
            expect(itemCount).to.equal(1);
        })
        it("Negative/nftContractNotInWhitelist", async function (){
            const tx = nftMarketPlace.connect(signer2).createAuctionItem(VegasONE.address, 0, true);
            await expect(tx).to.be.revertedWith("AddressNotInWhitelist")
        })
    });

    describe("listAuctionItem", function (){
        it("Positive", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).createAuctionItem(developer.address, 1, true);
            await tx.wait();

            tx = await nftMarketPlace.listAuctionItem(5,1);
            expect(tx[0].itemId).to.equal(2);
            expect(tx[0].seller).to.equal(signer3.address);
            expect(tx[1].itemId).to.equal(1);
            expect(tx[1].seller).to.equal(signer2.address);
        })
        it("Negative/outOfBounds", async function () {
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            tx = nftMarketPlace.listAuctionItem(1,2);
            await expect(tx).to.be.revertedWith("OutOfBounds");
        })
    });

    describe("listAuctionItemOf", function (){
        it("Positive", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            const price = ethers.utils.parseEther("1");
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, price);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).bidV(1, price);
            await tx.wait();
            await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);
            tx = await nftMarketPlace.connect(signer3).auctionEnd(1);
            await tx.wait();

            tx = await nftMarketPlace.connect(signer3).createAuctionItem(developer.address, 1, true);
            await tx.wait();
            tx = await developer.connect(signer3).approve(nftMarketPlace.address, 0);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            tx = await nftMarketPlace.listAuctionItemOf(signer3.address, 3, 1);
            expect(tx[0].itemId).to.be.equal(3);
            expect(tx[0].tokenId).to.be.equal(0);
            expect(tx[1].itemId).to.be.equal(2);
            expect(tx[1].tokenId).to.be.equal(1);
        })
        it("Negative/outOfBounds", async function () {
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            tx = nftMarketPlace.listAuctionItemOf(signer2.address, 1,2);
            await expect(tx).to.be.revertedWith("OutOfBounds");
        })
    });

    describe("removeAuctionItem", function (){
        it("Positive", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer2).removeAuctionItem(1);
            await tx.wait();

            tx = await nftMarketPlace.getAuctionItem(1);
            await expect(tx.soldOut).to.equal(true);
        })
        it("Negative/itemNotExist", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            tx = nftMarketPlace.connect(signer2).removeAuctionItem(2);
            await expect(tx).to.be.revertedWith("AuctionItemNotFound");
        })
        it("Negative/notRemovedBySeller", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            tx = nftMarketPlace.connect(signer3).removeAuctionItem(1);
            await expect(tx).to.be.revertedWith("OnlyRemovedBySellerOrAdmin");
        })
        it("Negative/hieghestBidderExist", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            const priceA = ethers.utils.parseEther("1");
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, priceA);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).bidV(1, priceA);
            await tx.wait();

            tx = nftMarketPlace.connect(signer2).removeAuctionItem(1);
            await expect(tx).to.be.revertedWith("CanNotRemovedWhenHighestBidderExist");
        })
    });

    describe("bidE", function (){
        it("Positive", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, false);
            await tx.wait();

            const priceA = ethers.utils.parseEther("1");
            tx = await nftMarketPlace.connect(signer3).bidE(1, {value: priceA});
            await tx.wait();
            const priceB = ethers.utils.parseEther("2");
            tx = await nftMarketPlace.connect(signer4).bidE(1, {value: priceB});
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).bidE(1, {value: priceB});
            await tx.wait();

            auctionItemDetails = await nftMarketPlace.getAuctionItem(1);
            expect(1).to.equal(auctionItemDetails.itemId);
            expect(developer.address).to.equal(auctionItemDetails.nftContract);
            expect(0).to.equal(auctionItemDetails.tokenId);
            expect(signer2.address).to.equal(auctionItemDetails.seller);
            expect(signer3.address).to.equal(auctionItemDetails.highestBidder);
            expect(priceA.add(priceB)).to.equal(auctionItemDetails.highestPrice);

            tx = await nftMarketPlace.connect(signer4).bidE(1, {value: priceB});
            await tx.wait();

            auctionItemDetails = await nftMarketPlace.getAuctionItem(1);
            expect(1).to.equal(auctionItemDetails.itemId);
            expect(developer.address).to.equal(auctionItemDetails.nftContract);
            expect(0).to.equal(auctionItemDetails.tokenId);
            expect(signer2.address).to.equal(auctionItemDetails.seller);
            expect(signer4.address).to.equal(auctionItemDetails.highestBidder);
            expect(priceB.add(priceB)).to.equal(auctionItemDetails.highestPrice);

            const revertBid = await nftMarketPlace.connect(signer3).revertableEth(1);
            expect(revertBid).to.equal(priceA.add(priceB));
        })
        it("Negative/itemNotExist", async function (){
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, false);
            await tx.wait();
            
            tx = nftMarketPlace.connect(signer3).bidE(2, {value: price});
            await expect(tx).to.be.revertedWith("AuctionItemNotFound");
        })
        it("Negative/self-purchase", async function (){
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, false);
            await tx.wait();
            
            tx = nftMarketPlace.connect(signer2).bidE(1, {value: price});
            await expect(tx).to.be.revertedWith("SelfPurchase");
        })
        it("Negative/purchaseWithVegasONE", async function (){
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();
            
            tx = nftMarketPlace.connect(signer3).bidE(1, {value: price});
            await expect(tx).to.be.revertedWith("OnlyAcceptEthForPayment");
        })
        it("Negative/theHighestBidder", async function (){
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, false);
            await tx.wait();
            
            tx = await nftMarketPlace.connect(signer3).bidE(1, {value: price});
            tx = nftMarketPlace.connect(signer3).bidE(1, {value: price.add(1)});
            await expect(tx).to.be.revertedWith("HighestBidderIsYou");
        })
        it("Negative/notExceedHighestPrice", async function (){
            const price = ethers.utils.parseEther("2");

            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, false);
            await tx.wait();
            
            tx = await nftMarketPlace.connect(signer3).bidE(1, {value: price});
            tx = nftMarketPlace.connect(signer4).bidE(1, {value: price.sub(1)});
            await expect(tx).to.be.revertedWith("NotExceedingHighestPrice");
        })
        it("Negative/auctionIsOver", async function (){
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, false);
            await tx.wait();

            await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);

            tx = nftMarketPlace.connect(signer3).bidE(1, {value: price});
            await expect(tx).to.be.revertedWith("AuctionIsOver");
        })
    });

    describe("bidV", function () {
        it("Positive", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            const priceA = ethers.utils.parseEther("1");
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, priceA);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).bidV(1, priceA);
            await tx.wait();

            const priceB = ethers.utils.parseEther("2");
            tx = await VegasONE.connect(signer4).approve(nftMarketPlace.address, priceB);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer4).bidV(1, priceB);
            await tx.wait();

            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, priceB);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).bidV(1, priceB);
            await tx.wait();

            auctionItemDetails = await nftMarketPlace.getAuctionItem(1);
            expect(1).to.equal(auctionItemDetails.itemId);
            expect(developer.address).to.equal(auctionItemDetails.nftContract);
            expect(0).to.equal(auctionItemDetails.tokenId);
            expect(signer2.address).to.equal(auctionItemDetails.seller);
            expect(signer3.address).to.equal(auctionItemDetails.highestBidder);
            expect(priceA.add(priceB)).to.equal(auctionItemDetails.highestPrice);

            tx = await VegasONE.connect(signer4).approve(nftMarketPlace.address, priceB);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer4).bidV(1, priceB);
            await tx.wait();

            auctionItemDetails = await nftMarketPlace.getAuctionItem(1);
            expect(1).to.equal(auctionItemDetails.itemId);
            expect(developer.address).to.equal(auctionItemDetails.nftContract);
            expect(0).to.equal(auctionItemDetails.tokenId);
            expect(signer2.address).to.equal(auctionItemDetails.seller);
            expect(signer4.address).to.equal(auctionItemDetails.highestBidder);
            expect(priceB.add(priceB)).to.equal(auctionItemDetails.highestPrice);

            const revertBid = await nftMarketPlace.connect(signer3).revertableVegasONE(1);
            expect(revertBid).to.equal(priceA.add(priceB));
        })
        it("Negative/itemNotExist", async function (){
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();
            
            tx = nftMarketPlace.connect(signer3).bidV(2, price);
            await expect(tx).to.be.revertedWith("AuctionItemNotFound");
        })
        it("Negative/self-purchase", async function (){
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();
            
            tx = nftMarketPlace.connect(signer2).bidV(1, price);
            await expect(tx).to.be.revertedWith("SelfPurchase");
        })
        it("Negative/purchaseWithVegasONE", async function (){
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, false);
            await tx.wait();
            
            tx = nftMarketPlace.connect(signer3).bidV(1, price);
            await expect(tx).to.be.revertedWith("OnlyAcceptVegasONEForPayment");
        })
        it("Negative/alreadyTheHighestBidder", async function (){
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, price);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).bidV(1, price);
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, price.add(1));
            await tx.wait();
            tx = nftMarketPlace.connect(signer3).bidV(1, price.add(1));
            await expect(tx).to.be.revertedWith("HighestBidderIsYou");
        })
        it("Negative/notExceedHighestPrice", async function (){
            const price = ethers.utils.parseEther("2");

            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();
    
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, price);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).bidV(1, price);
            tx = await VegasONE.connect(signer4).approve(nftMarketPlace.address, price.sub(1));
            await tx.wait();
            tx = nftMarketPlace.connect(signer4).bidV(1, price.sub(1));
            await expect(tx).to.be.revertedWith("NotExceedingHighestPrice");
        })
        it("Negative/auctionIsOver", async function (){
            const price = ethers.utils.parseEther("1");

            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);

            tx = nftMarketPlace.connect(signer3).bidV(1, price);
            await expect(tx).to.be.revertedWith("AuctionIsOver");
        })
    });

    describe("revertBid", function (){
        it("Positive/Eth",async function (){
           let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, false);
            await tx.wait();

            const bBefore = await signer3.getBalance();
            const priceA = ethers.utils.parseEther("1");
            tx = await nftMarketPlace.connect(signer3).bidE(1, {value: priceA});
            let tx1 = await tx.wait();
            const gasA = tx1.gasUsed.mul(tx1.effectiveGasPrice);

            const bBefore2 = await signer4.getBalance();
            const priceB = ethers.utils.parseEther("2");
            tx = await nftMarketPlace.connect(signer4).bidE(1, {value: priceB});
            tx1 = await tx.wait();
            const gasB = tx1.gasUsed.mul(tx1.effectiveGasPrice);

            const priceC = ethers.utils.parseEther("3");
            tx = await nftMarketPlace.connect(signer5).bidE(1, {value: priceC});
            await tx.wait();

            let revertableBid = await nftMarketPlace.connect(signer3).revertableEth(1);
            expect(revertableBid).to.equal(priceA);
            tx = await nftMarketPlace.connect(signer3).revertBidEth(signer3.address, 1);
            tx1 = await tx.wait();
            const gasA2 = tx1.gasUsed.mul(tx1.effectiveGasPrice);
            let bAfter = await signer3.getBalance();
            bAfter = bAfter.add(gasA).add(gasA2);
            expect(bAfter).to.equal(bBefore);
            revertableBid = await nftMarketPlace.connect(signer3).revertableEth(1);
            expect(revertableBid).to.equal(0);

            let day = 60 * 60 * 24 * 7;
            await network.provider.request({
                method: `evm_increaseTime`,
                params: [day],
            });

            tx = await nftMarketPlace.connect(signer5).auctionEnd(1);

            revertableBid = await nftMarketPlace.connect(signer4).revertableEth(1);
            expect(revertableBid).to.equal(priceB);
            tx = await nftMarketPlace.connect(signer4).revertBidEth(signer4.address, 1);
            tx1 = await tx.wait();
            const gasB2 = tx1.gasUsed.mul(tx1.effectiveGasPrice);
            let bAfter2 = await signer4.getBalance();
            bAfter2 = bAfter2.add(gasB).add(gasB2);
            expect(bAfter2).to.equal(bBefore2);
            revertableBid = await nftMarketPlace.connect(signer4).revertableEth(1);
            expect(revertableBid).to.equal(0);
        })
        it("Negative/Eth/bidderNotFound", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, false);
            await tx.wait();

            tx = nftMarketPlace.connect(signer4).revertBidEth(signer4.address, 1);
            await expect(tx).to.be.revertedWith("BidderNotFound");
        })
        it("Negative/Eth/highestBidderCanNotRevert", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, false);
            await tx.wait();

            const priceA = ethers.utils.parseEther("1");
            tx = await nftMarketPlace.connect(signer3).bidE(1, {value: priceA});
            await tx.wait();

            const priceB = ethers.utils.parseEther("2");
            tx = await nftMarketPlace.connect(signer4).bidE(1, {value: priceB});
            await tx.wait();

            tx = nftMarketPlace.connect(signer4).revertBidEth(signer4.address, 1);
            await expect(tx).to.be.revertedWith("HighestBidderCanNotRevertFunds");
        })
        it("Positive/VegasONE", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            const bBefore = await VegasONE.balanceOf(signer3.address);
            const bBefore2 = await VegasONE.balanceOf(signer4.address);
            const priceA = ethers.utils.parseEther("1");
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, priceA);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).bidV(1, priceA);
            await tx.wait();
            
            const priceB = ethers.utils.parseEther("2");
            tx = await VegasONE.connect(signer4).approve(nftMarketPlace.address, priceB);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer4).bidV(1, priceB);
            await tx.wait();
            
            const priceC = ethers.utils.parseEther("3");
            tx = await VegasONE.connect(signer5).approve(nftMarketPlace.address, priceC);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer5).bidV(1, priceC);
            await tx.wait();

            let bAfter = await VegasONE.balanceOf(signer3.address);
            let revertBid = await nftMarketPlace.connect(signer3).revertableVegasONE(1);
            expect(revertBid).to.equal(priceA);
            bAfter = bAfter.add(revertBid);
            expect(bAfter).to.equal(bBefore);

            tx = await nftMarketPlace.connect(signer3).revertBidVegasONE(signer3.address, 1);
            await tx.wait();
            bAfter = await VegasONE.balanceOf(signer3.address);
            expect(bAfter).to.equal(bBefore);
            revertBid = await nftMarketPlace.connect(signer3).revertableVegasONE(1);
            expect(revertBid).to.equal(0);

            let day = 60 * 60 * 24 * 7;
            await network.provider.request({
                method: `evm_increaseTime`,
                params: [day],
            });

            tx = await nftMarketPlace.connect(signer5).auctionEnd(1);

            bAfter = await VegasONE.balanceOf(signer4.address);
            revertBid = await nftMarketPlace.connect(signer4).revertableVegasONE(1);
            expect(revertBid).to.equal(priceB);
            bAfter = bAfter.add(revertBid);
            expect(bAfter).to.equal(bBefore2);

            tx = await nftMarketPlace.connect(signer4).revertBidVegasONE(signer4.address, 1);
            await tx.wait();
            bAfter = await VegasONE.balanceOf(signer4.address);
            expect(bAfter).to.equal(bBefore2);
            revertBid = await nftMarketPlace.connect(signer4).revertableVegasONE(1);
            expect(revertBid).to.equal(0);
        })
        it("Negative/VegasONE/bidderNotFound", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();
            
            tx = nftMarketPlace.connect(signer4).revertBidVegasONE(signer4.address, 1);
            await expect(tx).to.be.revertedWith("BidderNotFound");
        })
        it("Negative/VegasONE/highestBidderCanNotRevert", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            const priceA = ethers.utils.parseEther("1");
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, priceA);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).bidV(1, priceA);
            await tx.wait();
            
            const priceB = ethers.utils.parseEther("2");
            tx = await VegasONE.connect(signer4).approve(nftMarketPlace.address, priceB);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer4).bidV(1, priceB);
            await tx.wait();

            tx = nftMarketPlace.connect(signer4).revertBidVegasONE(signer4.address, 1);
            await expect(tx).to.be.revertedWith("HighestBidderCanNotRevertFunds");
        })
    });

    describe("auctionEnd", function (){
        it("Positive", async function (){
            let balanceCB = await VegasONE.balanceOf(nftMarketPlace.address);
            let balanceSB = await VegasONE.balanceOf(signer2.address);
            let balanceBB = await VegasONE.balanceOf(signer3.address);
            let nftCount = await developer.tokensOfOwner(signer2.address);
            expect(nftCount.length).to.equal(1);

            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            nftCount = await developer.tokensOfOwner(nftMarketPlace.address);
            expect(nftCount.length).to.equal(1);
            nftCount = await developer.tokensOfOwner(signer2.address);
            expect(nftCount.length).to.equal(0);

            const price = ethers.utils.parseEther("1");
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, price);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).bidV(1, price);
            await tx.wait();
            let realPrice = price.mul(97).div(100);
            let fee = price.sub(realPrice);

            let day = 60 * 60 * 24 * 7;
            await network.provider.request({
                method: `evm_increaseTime`,
                params: [day],
            });

            tx = await nftMarketPlace.connect(signer3).auctionEnd(1);

            nftCount = await developer.tokensOfOwner(nftMarketPlace.address);
            expect(nftCount.length).to.equal(0);
            nftCount = await developer.tokensOfOwner(signer3.address);
            expect(nftCount.length).to.equal(2);

            let balanceSA = await VegasONE.balanceOf(signer2.address);
            balanceSA = balanceSA.sub(realPrice);
            expect(balanceSA).to.equal(balanceSB);
            let balanceBA = await VegasONE.balanceOf(signer3.address);
            balanceBA = balanceBA.add(price);
            expect(balanceBA).to.equal(balanceBB);
            let balanceCA = await VegasONE.balanceOf(nftMarketPlace.address);
            balanceCB = balanceCB.add(fee);
            expect(balanceCA).to.equal(balanceCB);

            let withdrawalbe = await nftMarketPlace.drawableMPVegasONE();
            expect(withdrawalbe).to.equal(fee);
        })
        it("Negative/itemNotExist", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            tx = nftMarketPlace.connect(signer3).auctionEnd(2);
            await expect(tx).to.be.revertedWith("AuctionItemNotFound");
        })
        it("Negative/auctionNotOver", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            const price = ethers.utils.parseEther("1");
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, price);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).bidV(1, price);
            await tx.wait();

            tx = nftMarketPlace.connect(signer3).auctionEnd(1);
            await expect(tx).to.be.revertedWith("AuctionIsNotOver");
        })
        it("Negative/soldOut", async function () {
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            const price = ethers.utils.parseEther("1");
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, price);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).bidV(1, price);
            await tx.wait();

            let day = 60 * 60 * 24 * 7;
            await network.provider.request({
                method: `evm_increaseTime`,
                params: [day],
            });

            tx = await nftMarketPlace.connect(signer3).auctionEnd(1);
            await tx.wait();
            tx = nftMarketPlace.connect(signer2).auctionEnd(1);
            await expect(tx).to.be.revertedWith("SoldOut");
        })
        it("Negative/noOneBid", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);

            tx = nftMarketPlace.connect(signer3).auctionEnd(1);
            await expect(tx).to.be.revertedWith("NoOneBid");
        })
        it("Negative/notTheHighestBidderOrSeller", async function (){
            let tx = await nftMarketPlace.connect(signer2).createAuctionItem(developer.address, 0, true);
            await tx.wait();

            const price = ethers.utils.parseEther("1");
            tx = await VegasONE.connect(signer3).approve(nftMarketPlace.address, price);
            await tx.wait();
            tx = await nftMarketPlace.connect(signer3).bidV(1, price);
            await tx.wait();

            await ethers.provider.send('evm_increaseTime', [7 * 24 * 60 * 60]);

            tx = nftMarketPlace.connect(signer4).auctionEnd(1);
            await expect(tx).to.be.revertedWith("OnlyHighestBidderOrSellerCanEnd");
        })
    });
});