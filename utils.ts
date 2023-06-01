import { BigNumber, BigNumberish } from "ethers";
import { ethers } from "hardhat";
import deployments from "./deployments.json";
import { MerkleTree } from "merkletreejs";

interface NormalOrderFields {
  maker: string;
  taker: string;
  makerToken: string;
  takerToken: string;
  makerAmount: BigNumber;
  takerAmount: BigNumber;
  expiry: BigNumber;
}

interface NormalOrderInitialisable {
  maker: string;
  taker?: string;
  makerToken: string;
  takerToken: string;
  makerAmount: BigNumberish;
  takerAmount: BigNumberish;
  expiry?: BigNumberish;
}
export class NormalOrder {
  public static readonly STRUCT_NAME = "NormalOrder";
  public static readonly STRUCT_ABI = [
    { type: "address", name: "maker" },
    { type: "address", name: "taker" },
    { type: "address", name: "makerToken" },
    { type: "address", name: "takerToken" },
    { type: "uint256", name: "makerAmount" },
    { type: "uint256", name: "takerAmount" },
    { type: "uint256", name: "expiry" },
  ];

  public maker: string;
  public taker: string;
  public makerToken: string;
  public takerToken: string;
  public makerAmount: BigNumber;
  public takerAmount: BigNumber;
  public expiry: BigNumber;
  constructor(
    initData: NormalOrderInitialisable,
    public verifyingContract?: string,
    public chainId?: number
  ) {
    if (initData.taker) {
      this.taker = initData.taker;
    } else {
      this.taker = ethers.constants.AddressZero;
    }

    if (initData.expiry) {
      this.expiry = ethers.BigNumber.from(initData.expiry);
    } else {
      this.expiry = ethers.BigNumber.from(Math.floor(Date.now() / 1000 + 500));
    }

    this.maker = initData.maker;
    this.makerToken = initData.makerToken;
    this.makerAmount = ethers.BigNumber.from(initData.makerAmount);
    this.takerToken = initData.takerToken;
    this.takerAmount = ethers.BigNumber.from(initData.takerAmount);
  }

  getEIP712TypedData() {
    const domain = {
      name: "LimitOrderProtocol",
      version: "1",
      chainId: this.chainId ? this.chainId : 1,
      verifyingContract: this.verifyingContract
        ? this.verifyingContract
        : (deployments as any).LimitOrderProtocol,
    };

    const types = {
      [NormalOrder.STRUCT_NAME]: NormalOrder.STRUCT_ABI,
    };

    const message = {
      maker: this.maker,
      taker: this.taker,
      makerToken: this.makerToken,
      takerToken: this.takerToken,
      makerAmount: this.makerAmount,
      takerAmount: this.takerAmount,
      expiry: this.expiry,
    };

    return {
      types,
      domain,
      message,
    };
  }
}

interface MultiAssetOrderFields {
  maker: string;
  taker: string;
  makerToken: string;
  makerAmount: BigNumber;
  takerAssetMixHash: string;
  expiry: BigNumber;
}

interface MultiAssetOrderInitialisable {
  maker: string;
  taker?: string;
  makerToken: string;
  makerAmount: BigNumberish;
  expiry?: BigNumberish;
}
export class MultiAssetOrder {
  public static readonly STRUCT_NAME = "MultiAssetOrder";
  public static readonly STRUCT_ABI = [
    { type: "address", name: "maker" },
    { type: "address", name: "taker" },
    { type: "address", name: "makerToken" },
    { type: "string", name: "takerAssetMixHash" },
    { type: "uint256", name: "makerAmount" },
    { type: "uint256", name: "expiry" },
  ];

  public maker: string;
  public taker: string;
  public makerToken: string;
  public takerAssets: {
    address: string;
    amount: BigNumber;
  }[];
  public takerAssetMixHash: string;
  public makerAmount: BigNumber;
  public expiry: BigNumber;
  public merkleTree: MerkleTree;
  constructor(
    initData: MultiAssetOrderInitialisable,
    takerAssets: {
      address: string;
      amount: BigNumberish;
    }[],
    public verifyingContract?: string,
    public chainId?: number
  ) {
    if (initData.taker) {
      this.taker = initData.taker;
    } else {
      this.taker = ethers.constants.AddressZero;
    }

    if (initData.expiry) {
      this.expiry = ethers.BigNumber.from(initData.expiry);
    } else {
      this.expiry = ethers.BigNumber.from(Math.floor(Date.now() / 1000 + 500));
    }

    this.maker = initData.maker;
    this.makerToken = initData.makerToken;
    this.makerAmount = ethers.BigNumber.from(initData.makerAmount);
    this.takerAssets = takerAssets.map((takerAsset) => {
      return {
        address: takerAsset.address.toLowerCase(),
        amount: ethers.BigNumber.from(takerAsset.amount),
      };
    });
    const sortedTakerAssetHashes = MultiAssetOrder.getSortedTakerAssetHashes(
      this.takerAssets
    );
    this.merkleTree = new MerkleTree(
      sortedTakerAssetHashes,
      ethers.utils.keccak256
    );
    this.takerAssetMixHash = this.merkleTree.getHexRoot();
  }

  getTakerAssetProof(takerAssetAddress: string) {
    const l_takerAssetAddress = takerAssetAddress.toLowerCase();
    const takerAsset = this.takerAssets.find((takerAsset) => {
      if (l_takerAssetAddress == takerAsset.address) {
        return true;
      }
    });

    if (!takerAsset) {
      throw new Error("No such taker asset in the order");
    }

    const takerAssetHash = ethers.utils.keccak256(
      ethers.utils.solidityPack(
        ["address", "uint256"],
        [takerAsset.address, takerAsset.amount]
      )
    );

    return this.merkleTree.getProof(takerAssetHash);
  }

  static getSortedTakerAssetHashes(
    takerAssets: {
      address: string;
      amount: BigNumberish;
    }[]
  ) {
    takerAssets.sort((a, b) => {
      const aAddress = a.address.toLowerCase();
      const bAddress = b.address.toLowerCase();
      if (aAddress < bAddress) {
        return -1;
      } else if (aAddress == bAddress) {
        throw new Error("Multiple orders for same token");
      } else {
        return 1;
      }
    });

    return takerAssets.map((takerAsset) => {
      return ethers.utils.keccak256(
        ethers.utils.solidityPack(
          ["address", "uint256"],
          [takerAsset.address, takerAsset.amount]
        )
      );
    });
  }

  static getTakerAssetMixHash(
    takerAssets: {
      address: string;
      amount: BigNumberish;
    }[]
  ): string {
    const takerAssetHashes =
      MultiAssetOrder.getSortedTakerAssetHashes(takerAssets);

    const merkleTree = new MerkleTree(takerAssetHashes, ethers.utils.keccak256);
    return merkleTree.getHexRoot();
  }

  getEIP712TypedData() {
    const domain = {
      name: "LimitOrderProtocol",
      version: "1",
      chainId: this.chainId ? this.chainId : 1,
      verifyingContract: this.verifyingContract
        ? this.verifyingContract
        : (deployments as any).LimitOrderProtocol,
    };

    const types = {
      [MultiAssetOrder.STRUCT_NAME]: MultiAssetOrder.STRUCT_ABI,
    };

    const message = {
      maker: this.maker,
      taker: this.taker,
      makerToken: this.makerToken,
      takerAssetMixHash: this.takerAssetMixHash,
      makerAmount: this.makerAmount,
      expiry: this.expiry,
    };

    return {
      types,
      domain,
      message,
    };
  }
}
