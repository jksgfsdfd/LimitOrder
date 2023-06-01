import { toUtf8Bytes } from "ethers/lib/utils";
import { ethers } from "ethers";

function getStringKeccakHash(item: string): string {
  return ethers.utils.keccak256(toUtf8Bytes(item));
}

let NormalOrder = `struct NormalOrder {
  address maker;
  address taker;
  address makerToken;
  address takerToken;
  uint256 makerAmount;
  uint256 takerAmount;
  uint256 expiry;
}`;

let MultiAssetOrder = `struct MultiAssetOrder {
  address maker;
  address taker;
  address makerToken;
  uint256 makerAmount;
  bytes32 takerAssetMixHash;
  uint256 expiry;
}`;

function parseSolidityStruct(solidityStruct: string): string {
  let parsedString: string = "";

  let words = solidityStruct.match(/[a-zA-Z0-9]+/g);
  if (!words) {
    throw new Error("Invalid strcut string");
  }
  parsedString += words[1];
  parsedString += "(";
  for (let i = 2; i < words.length; i++) {
    if (i % 2 == 0) {
      parsedString += words[i];
      parsedString += " ";
    } else {
      parsedString += words[i];
      parsedString += ",";
    }
  }

  return parsedString.substring(0, parsedString.length - 1) + ")";
}

const typeHashNormalOrder = getStringKeccakHash(
  parseSolidityStruct(NormalOrder)
);
const typeHashMultiAssetOrder = getStringKeccakHash(
  parseSolidityStruct(MultiAssetOrder)
);

console.log("Normal Order : ", typeHashNormalOrder);
console.log("MultiAsset Order : ", typeHashMultiAssetOrder);
