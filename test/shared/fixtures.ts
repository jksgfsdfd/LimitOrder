import { writeFileSync } from "fs";
import { ethers } from "hardhat";
import deployments from "../../deployments.json";
import { LimitOrderProtocol } from "../../typechain-types";

export async function tokensDeployedFixture() {
  const signers = await ethers.getSigners();
  const tokenFactory = await ethers.getContractFactory("TestERC20", signers[0]);
  const token1 = await tokenFactory.deploy(1000);
  const token2 = await tokenFactory.deploy(1000);
  const token3 = await tokenFactory.deploy(1000);
  const newDeployments: any = deployments;
  newDeployments["Token1"] = token1.address;
  newDeployments["Token2"] = token2.address;
  newDeployments["Token3"] = token3.address;
  writeFileSync("deployments.json", JSON.stringify(newDeployments));
  return {
    token1,
    token2,
    token3,
  };
}

export async function limitOrderDeployedFixture() {
  const { token1, token2, token3 } = await tokensDeployedFixture();
  const signers = await ethers.getSigners();
  const limitOrderFactory = await ethers.getContractFactory(
    "LimitOrderProtocol",
    signers[0]
  );

  const limitOrderImplementation = await limitOrderFactory.deploy();
  const limitOrderProxyFactory = await ethers.getContractFactory(
    "LimitOrderProxy",
    signers[0]
  );
  const limitOrderProxy = await limitOrderProxyFactory.deploy(
    limitOrderImplementation.address
  );
  const limitOrderInteraction = await ethers.getContractAt(
    "LimitOrderProtocol",
    limitOrderProxy.address
  );
  const newDeployments: any = deployments;
  newDeployments["LimitOrderProtocol"] = limitOrderProxy.address;
  writeFileSync("deployments.json", JSON.stringify(newDeployments));
  return {
    token1,
    token2,
    token3,
    limitOrder: limitOrderInteraction,
  };
}
