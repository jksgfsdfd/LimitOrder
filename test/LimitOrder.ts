import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { MultiAssetOrder, NormalOrder } from "../utils";
import { limitOrderDeployedFixture } from "./shared/fixtures";

describe("Limit Order", function () {
  describe("Normal Order", function () {
    it("Successfully transfers tokens when correctly filled", async () => {
      const { token1, token2, token3, limitOrder } = await loadFixture(
        limitOrderDeployedFixture
      );
      const [maker, taker] = await ethers.getSigners();
      const makerToken = token1;
      const takerToken = token2;
      const makerAmount = ethers.utils.parseEther("3600");
      const takerAmount = ethers.utils.parseEther("2");
      const normalOrder = new NormalOrder(
        {
          maker: maker.address,
          makerToken: makerToken.address,
          makerAmount: makerAmount,
          takerToken: takerToken.address,
          takerAmount: takerAmount,
        },
        limitOrder.address,
        network.config.chainId
      );

      const typedData = normalOrder.getEIP712TypedData();
      const joinedSig = await maker._signTypedData(
        typedData.domain,
        typedData.types,
        typedData.message
      );
      const { v, r, s } = ethers.utils.splitSignature(joinedSig);
      const signature = { v, r, s };

      // set balances and approvals

      const mintMakerTokenTx = await token1
        .connect(maker)
        .mint(maker.address, ethers.utils.parseEther("10000"));
      await mintMakerTokenTx.wait();

      const approveMakerTokenTx = await token1
        .connect(maker)
        .approve(limitOrder.address, ethers.constants.MaxUint256);
      await approveMakerTokenTx.wait();

      const mintTakerTokenTx = await token2
        .connect(taker)
        .mint(taker.address, ethers.utils.parseEther("10000"));
      await mintTakerTokenTx.wait();

      const approveTakerTokenTx = await token2
        .connect(taker)
        .approve(limitOrder.address, ethers.constants.MaxUint256);
      await approveTakerTokenTx.wait();

      const fillAmount = ethers.utils.parseEther("1");
      await expect(
        limitOrder
          .connect(taker)
          .fillNormalOrder(normalOrder, signature, fillAmount)
      )
        .to.emit(limitOrder, "NormalOrderFilled")
        .withArgs(
          ethers.utils._TypedDataEncoder.hash(
            typedData.domain,
            typedData.types,
            typedData.message
          ),
          maker.address,
          taker.address,
          makerToken.address,
          takerToken.address,
          ethers.utils.parseEther("1800"),
          fillAmount
        );
    });
  });

  describe("MultiAsset Orders", function () {
    it("Emits event when filled", async () => {
      const { token1, token2, token3, limitOrder } = await loadFixture(
        limitOrderDeployedFixture
      );

      const [maker, taker] = await ethers.getSigners();
      const makerToken = token1;
      const takerToken1 = token2;
      const takerToken2 = token3;
      const makerAmount = ethers.utils.parseEther("3600");
      const takerAmount1 = ethers.utils.parseEther("2");
      const takerAmount2 = ethers.utils.parseEther("720");
      const multiAssetOrder = new MultiAssetOrder(
        {
          maker: maker.address,
          makerToken: makerToken.address,
          makerAmount: makerAmount,
        },
        [
          { address: takerToken1.address, amount: takerAmount1 },
          { address: takerToken2.address, amount: takerAmount2 },
        ],
        limitOrder.address,
        network.config.chainId
      );

      const typedData = multiAssetOrder.getEIP712TypedData();
      const joinedSig = await maker._signTypedData(
        typedData.domain,
        typedData.types,
        typedData.message
      );
      const { v, r, s } = ethers.utils.splitSignature(joinedSig);
      const signature = { v, r, s };

      // set balances and approvals

      const mintMakerTokenTx = await token1
        .connect(maker)
        .mint(maker.address, ethers.utils.parseEther("10000"));
      await mintMakerTokenTx.wait();

      const approveMakerTokenTx = await token1
        .connect(maker)
        .approve(limitOrder.address, ethers.constants.MaxUint256);
      await approveMakerTokenTx.wait();

      const mintTakerTokenTx = await token2
        .connect(taker)
        .mint(taker.address, ethers.utils.parseEther("10000"));
      await mintTakerTokenTx.wait();

      const approveTakerTokenTx = await token2
        .connect(taker)
        .approve(limitOrder.address, ethers.constants.MaxUint256);
      await approveTakerTokenTx.wait();

      const fillAmount = ethers.utils.parseEther("1");
      const proof = multiAssetOrder.getTakerAssetProof(takerToken1.address);
      await expect(
        limitOrder
          .connect(taker)
          .fillMultiAssetOrder(multiAssetOrder, signature, {
            fillToken: takerToken1.address,
            fillAmount,
            fillTokenOrderAmount: takerAmount1,
            proof,
          })
      )
        .to.emit(limitOrder, "MultiAssetOrderFilled")
        .withArgs(
          ethers.utils._TypedDataEncoder.hash(
            typedData.domain,
            typedData.types,
            typedData.message
          ),
          maker.address,
          taker.address,
          makerToken.address,
          takerToken1.address,
          ethers.utils.parseEther("1800"),
          fillAmount
        );
    });

    it("Allows to fill with multiple tokens", async () => {
      const { token1, token2, token3, limitOrder } = await loadFixture(
        limitOrderDeployedFixture
      );

      const [maker, taker] = await ethers.getSigners();
      const makerToken = token1;
      const takerToken1 = token2;
      const takerToken2 = token3;
      const makerAmount = ethers.utils.parseEther("3600");
      const takerAmount1 = ethers.utils.parseEther("2");
      const takerAmount2 = ethers.utils.parseEther("720");
      const multiAssetOrder = new MultiAssetOrder(
        {
          maker: maker.address,
          makerToken: makerToken.address,
          makerAmount: makerAmount,
        },
        [
          { address: takerToken1.address, amount: takerAmount1 },
          { address: takerToken2.address, amount: takerAmount2 },
        ],
        limitOrder.address,
        network.config.chainId
      );

      const typedData = multiAssetOrder.getEIP712TypedData();
      const joinedSig = await maker._signTypedData(
        typedData.domain,
        typedData.types,
        typedData.message
      );
      const { v, r, s } = ethers.utils.splitSignature(joinedSig);
      const signature = { v, r, s };

      // set balances and approvals
      const mintMakerTokenTx = await makerToken
        .connect(maker)
        .mint(maker.address, ethers.utils.parseEther("10000"));
      await mintMakerTokenTx.wait();

      const approveMakerTokenTx = await makerToken
        .connect(maker)
        .approve(limitOrder.address, ethers.constants.MaxUint256);
      await approveMakerTokenTx.wait();

      const mintTakerTokenT1x = await takerToken1
        .connect(taker)
        .mint(taker.address, ethers.utils.parseEther("10000"));
      await mintTakerTokenT1x.wait();

      const approveTakerTokenT1x = await takerToken1
        .connect(taker)
        .approve(limitOrder.address, ethers.constants.MaxUint256);
      await approveTakerTokenT1x.wait();

      const fillAmount1 = ethers.utils.parseEther("1");
      const proof1 = multiAssetOrder.getTakerAssetProof(takerToken1.address);
      await expect(
        limitOrder
          .connect(taker)
          .fillMultiAssetOrder(multiAssetOrder, signature, {
            fillToken: takerToken1.address,
            fillAmount: fillAmount1,
            fillTokenOrderAmount: takerAmount1,
            proof: proof1,
          })
      )
        .to.emit(limitOrder, "MultiAssetOrderFilled")
        .withArgs(
          ethers.utils._TypedDataEncoder.hash(
            typedData.domain,
            typedData.types,
            typedData.message
          ),
          maker.address,
          taker.address,
          makerToken.address,
          takerToken1.address,
          ethers.utils.parseEther("1800"),
          fillAmount1
        );

      const mintTakerTokenT2x = await takerToken2
        .connect(taker)
        .mint(taker.address, ethers.utils.parseEther("20000"));
      await mintTakerTokenT2x.wait();

      const approveTakerTokenT2x = await takerToken2
        .connect(taker)
        .approve(limitOrder.address, ethers.constants.MaxUint256);
      await approveTakerTokenT2x.wait();

      const fillAmount2 = ethers.utils.parseEther("360");
      const proof2 = multiAssetOrder.getTakerAssetProof(takerToken2.address);
      await expect(
        limitOrder
          .connect(taker)
          .fillMultiAssetOrder(multiAssetOrder, signature, {
            fillToken: takerToken2.address,
            fillAmount: fillAmount2,
            fillTokenOrderAmount: takerAmount2,
            proof: proof2,
          })
      )
        .to.emit(limitOrder, "MultiAssetOrderFilled")
        .withArgs(
          ethers.utils._TypedDataEncoder.hash(
            typedData.domain,
            typedData.types,
            typedData.message
          ),
          maker.address,
          taker.address,
          makerToken.address,
          takerToken2.address,
          ethers.utils.parseEther("1800"),
          fillAmount2
        );
    });

    it("reverts on attempting a fill with an invalid proof", async () => {
      const { token1, token2, token3, limitOrder } = await loadFixture(
        limitOrderDeployedFixture
      );

      const [maker, taker] = await ethers.getSigners();
      const makerToken = token1;
      const takerToken1 = token2;
      const takerToken2 = token3;
      const makerAmount = ethers.utils.parseEther("3600");
      const takerAmount1 = ethers.utils.parseEther("2");
      const takerAmount2 = ethers.utils.parseEther("720");
      const multiAssetOrder = new MultiAssetOrder(
        {
          maker: maker.address,
          makerToken: makerToken.address,
          makerAmount: makerAmount,
        },
        [
          { address: takerToken1.address, amount: takerAmount1 },
          { address: takerToken2.address, amount: takerAmount2 },
        ],
        limitOrder.address,
        network.config.chainId
      );

      const typedData = multiAssetOrder.getEIP712TypedData();
      const joinedSig = await maker._signTypedData(
        typedData.domain,
        typedData.types,
        typedData.message
      );
      const { v, r, s } = ethers.utils.splitSignature(joinedSig);
      const signature = { v, r, s };

      // set balances and approvals
      const mintMakerTokenTx = await makerToken
        .connect(maker)
        .mint(maker.address, ethers.utils.parseEther("10000"));
      await mintMakerTokenTx.wait();

      const approveMakerTokenTx = await makerToken
        .connect(maker)
        .approve(limitOrder.address, ethers.constants.MaxUint256);
      await approveMakerTokenTx.wait();

      const mintInvalidTokenTx = await token3
        .connect(taker)
        .mint(taker.address, ethers.utils.parseEther("10000"));
      await mintInvalidTokenTx.wait();

      const approveInvalidTokenTx = await token3
        .connect(taker)
        .approve(limitOrder.address, ethers.constants.MaxUint256);
      await approveInvalidTokenTx.wait();

      const fillAmount = ethers.utils.parseEther("1");
      const fakeProof = multiAssetOrder.getTakerAssetProof(takerToken1.address);
      await expect(
        limitOrder
          .connect(taker)
          .fillMultiAssetOrder(multiAssetOrder, signature, {
            fillToken: token3.address,
            fillAmount: fillAmount,
            fillTokenOrderAmount: takerAmount1,
            proof: fakeProof,
          })
      ).to.be.revertedWithCustomError(limitOrder, "InvalidBuyAsset");
    });
  });
});
