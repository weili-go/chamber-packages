// const { injectInTruffle } = require('sol-trace');
// injectInTruffle(web3, artifacts);
const { deployRLPdecoder } = require('./helpers/deployRLPdecoder')
const {
  duration,
  increaseTime,
} = require('./helpers/increaseTime')
const {
  assertRevert
} = require('./helpers/assertRevert');

const utils = require("ethereumjs-util")
const RootChain = artifacts.require("RootChain")
const TransactionVerifier = artifacts.require("TransactionVerifier")
const StandardVerifier = artifacts.require("StandardVerifier")
const MultisigVerifier = artifacts.require("MultisigVerifier")

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
    this.standardVerifier = await StandardVerifier.new({ from: operator })
    this.multisigVerifier = await MultisigVerifier.new({ from: operator })
    this.transactionVerifier = await TransactionVerifier.new(
      this.standardVerifier.address,
      this.multisigVerifier.address,
      {
        from: operator
      })
    this.rootChain = await RootChain.new(
      this.transactionVerifier.address,
      {
        from: operator
      })
  });

  describe("submit", () => {
    const root = Scenario1.blocks[0].tree.root();

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

    beforeEach(async () => {
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
      await this.rootChain.submit(
        utils.bufferToHex(Scenario1.blocks[0].tree.root()),
        {
          from: operator
        });
      await this.rootChain.submit(
        utils.bufferToHex(Scenario1.blocks[1].tree.root()),
        {
          from: operator
        });
      await this.rootChain.submit(
        utils.bufferToHex(Scenario1.blocks[2].tree.root()),
        {
          from: operator
        });
    })

    it("should success to exit and finalizeExit", async () => {
      const tx = Scenario1.blocks[0].signedTransactions[0]
      const gasCost = await this.rootChain.exit.estimateGas(
        6 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        tx.tx.encode(),
        tx.getProofs(),
        tx.getSignatures(),
        {
          from: bob
        });
      // gas cost of exit is 116480
      console.log('gasCost', gasCost)
      const result = await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        tx.tx.encode(),
        tx.getProofs(),
        tx.getSignatures(),
        {
          from: bob
        });
      assert.equal(result.logs[0].event, 'ExitStarted')
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      await this.rootChain.finalizeExit(
        tx.tx.hash(),
        {
          from: bob
        });
    })

    it("should success to challenge", async () => {
      const tx = Scenario1.blocks[0].signedTransactions[0]
      await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        tx.tx.encode(),
        tx.getProofs(),
        tx.getSignatures(),
        {
          from: bob
        });
      const challengeTx = Scenario1.blocks[1].signedTransactions[0]
      await this.rootChain.challenge(
        tx.tx.encode(),
        8 * 100 + 10,
        -1,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        challengeTx.tx.encode(),
        challengeTx.getProofs(),
        challengeTx.getSignatures(),
        {
          from: alice,
          gas: '500000'
        });
    })

    it("should success to challengeBefore", async () => {
      const tx = Scenario1.blocks[2].signedTransactions[0]
      await this.rootChain.exit(
        10 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        tx.tx.encode(),
        tx.getProofs(),
        tx.getSignatures(),
        {
          from: operator
        });

      const challengeTx = Scenario1.blocks[1].signedTransactions[0]
      await this.rootChain.challengeBefore(
        tx.tx.encode(),
        8 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        challengeTx.tx.encode(),
        challengeTx.tx.hash(),
        challengeTx.getProofs(),
        challengeTx.getSignatures(),
        {
          from: alice,
          gas: '500000'
        });
      // 6 weeks after
      const exitResult = await this.rootChain.getExit(tx.tx.hash())
      // challengeCount is 1
      assert.equal(exitResult[1].toNumber(), 1)
      await increaseTime(duration.weeks(6))
      await assertRevert(this.rootChain.finalizeExit(
        tx.tx.hash(),
        {
          from: operator
        }))
    })

    it("should success to respondChallenge", async () => {
      const tx = Scenario1.blocks[2].signedTransactions[0]
      await this.rootChain.exit(
        10 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        tx.tx.encode(),
        tx.getProofs(),
        tx.getSignatures(),
        {
          from: operator
        });

      const challengeTx = Scenario1.blocks[0].signedTransactions[0]
      await this.rootChain.challengeBefore(
        tx.tx.encode(),
        6 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        challengeTx.tx.encode(),
        challengeTx.tx.hash(),
        challengeTx.getProofs(),
        challengeTx.getSignatures(),
        {
          from: bob,
          gas: '500000'
        });
      const respondTx = Scenario1.blocks[1].signedTransactions[0]
      await this.rootChain.respondChallenge(
        challengeTx.tx.encode(),
        8 * 100 + 10,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        respondTx.tx.encode(),
        respondTx.getProofs(),
        respondTx.getSignatures(),
        {
          from: operator,
          gas: '500000'
        });
      const exitResult = await this.rootChain.getExit(tx.tx.hash())
      // challengeCount is 0
      assert.equal(exitResult[1].toNumber(), 0)
    })

  });

})
