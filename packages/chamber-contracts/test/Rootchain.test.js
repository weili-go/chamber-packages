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


contract("RootChain", ([alice, bob, operator, user4, user5, admin]) => {

  beforeEach(async () => {
    await deployRLPdecoder(alice)
    this.rootChain = await RootChain.new({ from: operator })
  });

  describe("submit", () => {
    const root = Scenario1.tree.root();

    it("should submit", async () => {
      const hex = utils.bufferToHex(root)
      const result = await this.rootChain.submit(
        hex,
        {
          from: operator
        });
      assert.equal(result.logs[0].event, 'BlockSubmitted')
    })
  });

  describe("exit", () => {
    it("should success to exit", async () => {
      await this.rootChain.deposit(
        {
          from: alice,
          value: '1000000'
        });
      await this.rootChain.deposit(
        {
          from: bob,
          value: '1000000'
        });
      const hex = utils.bufferToHex(Scenario1.tree.root())
      await this.rootChain.submit(
        hex,
        {
          from: operator
        });
      const tx = Scenario1.signedTransactions[0]
      const result = await this.rootChain.exit(
        6,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        tx.tx.encode(),
        tx.getProofs(),
        tx.getSignatures(),
        {
          from: bob
        });
      assert.equal(result.logs[0].event, 'ExitStarted')
    })
  });

})
