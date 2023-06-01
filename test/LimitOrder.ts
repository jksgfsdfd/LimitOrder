import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { NormalOrder } from "../utils";
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
        ethers.provider.network.chainId
      );

      const { types, domain, message } = normalOrder.getEIP712TypedData();
      const joinedSig = await maker._signTypedData(domain, types, message);
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
      ).to.emit(limitOrder, "NormalOrderFilled");
    });
  });
});
