const { deployRLPdecoder } = require('./helpers/deployRLPdecoder')

const utils = require("ethereumjs-util")
const {
  Segment,
  SumMerkleTree,
  SumMerkleTreeNode
} = require('@layer2/core')
const RootChain = artifacts.require("RootChain")

const ethers = require('ethers')

const BigNumber = ethers.utils.BigNumber

const {
  Scenario1
} = require('./testdata')

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();


contract("RootChain", ([owner, nonOwner]) => {

  beforeEach(async () => {
    await deployRLPdecoder(owner)
    this.rootChain = await RootChain.new()
  });

  describe("submit", () => {
    const root = Scenario1.tree.root();

    it("should submit", async () => {
      const hex = utils.bufferToHex(root)
      const result = await this.rootChain.submit(
        hex,
        {
          from: owner
        });
      assert.equal(result.logs[0].event, 'BlockSubmitted')
    })
  });

})
