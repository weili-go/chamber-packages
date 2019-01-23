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

const RootChain = artifacts.require("RootChain")
const TransactionVerifier = artifacts.require("TransactionVerifier")
const StandardVerifier = artifacts.require("StandardVerifier")
const MultisigVerifier = artifacts.require("MultisigVerifier")
const ethers = require('ethers')
const BigNumber = ethers.utils.BigNumber

const {
  Scenario1,
  Scenario2
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

    it("should submit", async () => {
      const result = await this.rootChain.submit(
        Scenario1.blocks[0].block.getRoot(),
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
      const submit = async (root) => {
        await this.rootChain.submit(
          root,
          {
            from: operator
          });
      }
      await submit(Scenario1.blocks[0].block.getRoot())
      await submit(Scenario1.blocks[1].block.getRoot())
      await submit(Scenario1.blocks[2].block.getRoot())
      await submit(Scenario1.blocks[3].block.getRoot())
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
        tx.toHex(),
        tx.getProofs(),
        tx.getSignatures(),
        {
          from: bob
        });
      assert.equal(result.logs[0].event, 'ExitStarted')
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      await this.rootChain.finalizeExit(
        tx.hash(),
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
        tx.toHex(),
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
        challengeTx.toHex(),
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
        tx.toHex(),
        tx.getProofs(),
        tx.getSignatures(),
        {
          from: operator
        });

      const challengeTx = Scenario1.blocks[1].signedTransactions[0]
      await this.rootChain.challengeBefore(
        tx.hash(),
        8 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        challengeTx.toHex(),
        challengeTx.hash(),
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
        tx.toHex(),
        tx.getProofs(),
        tx.getSignatures(),
        {
          from: operator
        });

      const challengeTx = Scenario1.blocks[0].signedTransactions[0]
      await this.rootChain.challengeBefore(
        tx.hash(),
        6 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        challengeTx.toHex(),
        challengeTx.hash(),
        challengeTx.getProofs(),
        challengeTx.getSignatures(),
        {
          from: bob,
          gas: '500000'
        });
      const respondTx = Scenario1.blocks[1].signedTransactions[0]
      await this.rootChain.respondChallenge(
        challengeTx.toHex(),
        8 * 100 + 10,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        respondTx.toHex(),
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

    it("should success to challengeByWithdrawal", async () => {
      const tx = Scenario1.blocks[0].signedTransactions[0]
      await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        tx.toHex(),
        tx.getProofs(),
        tx.getSignatures(),
        {
          from: bob
        });
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      await this.rootChain.finalizeExit(
        tx.hash(),
        {
          from: bob
        });
      const invalidTx = Scenario1.blocks[3].signedTransactions[0]
      await this.rootChain.exit(
        12 * 100,
        Scenario1.segments[2].start,
        Scenario1.segments[2].end,
        invalidTx.toHex(),
        invalidTx.getProofs(),
        invalidTx.getSignatures(),
        {
          from: operator
        });
      await this.rootChain.challengeByWithdrawal(
        invalidTx.hash(),
        Scenario1.segments[0].toBigNumber(),
        {
          from: bob
        });
    
    })

  });

  describe("forceInclude", () => {

    beforeEach(async () => {
      await this.rootChain.deposit(
        {
          from: alice,
          value: '1000000'
        });
      await this.rootChain.deposit(
        {
          from: operator,
          value: '1000000'
        });
      const submit = async (root) => {
        await this.rootChain.submit(
          root,
          {
            from: operator
          });
      }
      await submit(Scenario2.blocks[0].block.getRoot())
      await submit(Scenario2.blocks[1].block.getRoot())
    })

    it("should success to force include", async () => {
      const tx1 = Scenario2.blocks[1].signedTransactions[0]
      const tx2 = Scenario2.blocks[1].signedTransactions[1]
      const forceIncludeTx = Scenario2.blocks[0].testTxs[0]
      await this.rootChain.exit(
        8 * 100,
        Scenario2.segments[3].start,
        Scenario2.segments[3].end,
        tx1.toHex(),
        tx1.getProofs(),
        tx1.getSignatures(),
        {
          from: operator
        });
      await this.rootChain.exit(
        8 * 100,
        Scenario2.segments[4].start,
        Scenario2.segments[4].end,
        tx2.toHex(),
        tx2.getProofs(),
        tx2.getSignatures(),
        {
          from: operator
        });
      await this.rootChain.forceInclude(
        tx2.hash(),
        6 * 100 + 1,
        Scenario2.segments[4].start,
        Scenario2.segments[4].end,
        forceIncludeTx.toHex(),
        forceIncludeTx.getProofs(),
        forceIncludeTx.getSignatures(),
        0,
        {
          from: alice,
          gas: '800000'
        });
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      // operator can't exit tx2
      await assertRevert(this.rootChain.finalizeExit(
        tx2.hash(),
        {
          from: operator
        }))
    })

    it("should success to respond a force include", async () => {
      const tx1 = Scenario2.blocks[1].signedTransactions[0]
      const tx2 = Scenario2.blocks[1].signedTransactions[1]
      const forceIncludeTx = Scenario2.blocks[0].testTxs[0]
      const fullForceIncludeTx = Scenario2.blocks[0].signedTransactions[0]
      await this.rootChain.exit(
        8 * 100,
        Scenario2.segments[3].start,
        Scenario2.segments[3].end,
        tx1.toHex(),
        tx1.getProofs(),
        tx1.getSignatures(),
        {
          from: operator
        });
      await this.rootChain.exit(
        8 * 100,
        Scenario2.segments[4].start,
        Scenario2.segments[4].end,
        tx2.toHex(),
        tx2.getProofs(),
        tx2.getSignatures(),
        {
          from: operator
        });
      await this.rootChain.forceInclude(
        tx2.hash(),
        6 * 100 + 1,
        Scenario2.segments[4].start,
        Scenario2.segments[4].end,
        forceIncludeTx.toHex(),
        forceIncludeTx.getProofs(),
        forceIncludeTx.getSignatures(),
        0,
        {
          from: alice
        });
      await this.rootChain.respondForceInclude(
        6 * 100 + 1,
        Scenario2.segments[4].start,
        Scenario2.segments[4].end,
        fullForceIncludeTx.toHex(),
        fullForceIncludeTx.getProofs(),
        fullForceIncludeTx.getSignatures(),
        {
          from: operator,
          gas: '800000'
        });
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      // operator can't exit tx2
      await this.rootChain.finalizeExit(
        tx2.hash(),
        {
          from: operator
        })
    })

  });

})
