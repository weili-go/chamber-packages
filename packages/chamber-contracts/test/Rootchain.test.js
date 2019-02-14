// const { injectInTruffle } = require('sol-trace');
// injectInTruffle(web3, artifacts);
const {
  duration,
  increaseTime,
} = require('./helpers/increaseTime')
const {
  assertRevert
} = require('./helpers/assertRevert')

const RootChain = artifacts.require("RootChain")
const TransactionVerifier = artifacts.require("TransactionVerifier")
const StandardVerifier = artifacts.require("StandardVerifier")
const MultisigVerifier = artifacts.require("MultisigVerifier")
const EscrowVerifier = artifacts.require("EscrowVerifier")
const ethers = require('ethers')
const BigNumber = ethers.utils.BigNumber

const {
  constants,
  Segment
} = require('@layer2/core')

const {
  Scenario1,
  Scenario2,
  Scenario3
} = require('./testdata')

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const BOND = constants.EXIT_BOND

contract("RootChain", ([alice, bob, operator, user4, user5, admin]) => {

  beforeEach(async () => {
    this.standardVerifier = await StandardVerifier.new({ from: operator })
    this.multisigVerifier = await MultisigVerifier.new({ from: operator })
    this.escrowVerifier = await EscrowVerifier.new({ from: operator })
    this.transactionVerifier = await TransactionVerifier.new(
      this.standardVerifier.address,
      this.multisigVerifier.address,
      this.escrowVerifier.address,
      {
        from: operator
      })
    this.rootChain = await RootChain.new(
      this.transactionVerifier.address,
      {
        from: operator
      })
    await this.rootChain.setup()
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

    const exitableEnd = Scenario1.segments[1].end

    beforeEach(async () => {
      const result = await this.rootChain.deposit(
        {
          from: alice,
          value: '1000000000000000'
        });
      await this.rootChain.deposit(
        {
          from: bob,
          value: '1000000000000000'
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
        Scenario1.segments[0].toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        0,
        {
          from: bob,
          value: BOND
        });
      // gas cost of exit is 116480
      console.log('gasCost', gasCost)
      const result = await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        0,
        {
          from: bob,
          value: BOND
        });
      const exitId = result.receipt.logs[0].args._exitId
      assert.equal(result.logs[0].event, 'ExitStarted')
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      await this.rootChain.finalizeExit(
        exitableEnd,
        exitId,
        {
          from: bob
        });
    })

    it("should success to challenge", async () => {
      const tx = Scenario1.blocks[0].signedTransactions[0]
      const result = await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        0,
        {
          from: bob,
          value: BOND
        });
      const exitId = result.receipt.logs[0].args._exitId
      const challengeTx = Scenario1.blocks[1].signedTransactions[0]
      await this.rootChain.challenge(
        exitId,
        tx.getTxBytes(),
        8 * 100 + 10,
        -1,
        Scenario1.segments[0].toBigNumber(),
        challengeTx.getTxBytes(),
        challengeTx.getProofAsHex(),
        challengeTx.getSignatures(),
        {
          from: alice,
          gas: '500000'
        });
    })

    it("should success to challengeBefore", async () => {
      const tx = Scenario1.blocks[2].signedTransactions[0]
      const result = await this.rootChain.exit(
        10 * 100,
        Scenario1.segments[0].toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        0,
        {
          from: operator,
          value: BOND
        });

      const challengeTx = Scenario1.blocks[1].signedTransactions[0]
      const exitId = result.receipt.logs[0].args._exitId
      const result2 = await this.rootChain.exit(
        8 * 100,
        Scenario1.segments[0].toBigNumber(),
        challengeTx.getTxBytes(),
        challengeTx.getProofAsHex(),
        challengeTx.getSignatures(),
        0,
        {
          from: alice,
          value: BOND
        });
      const exitId2 = result2.receipt.logs[0].args._exitId
      await this.rootChain.requestHigherPriorityExit(
        exitId2,
        exitId,
        {
          from: alice
        });
      // 6 weeks after
      const exitResult = await this.rootChain.getExit(exitId)
      // challengeCount is 1
      assert.equal(exitResult[1].toNumber(), 1)
      await increaseTime(duration.weeks(6))
      await assertRevert(this.rootChain.finalizeExit(
        exitableEnd,
        exitId,
        {
          from: operator
        }))
    })

    it("should success to respondChallenge", async () => {
      const tx = Scenario1.blocks[2].signedTransactions[0]
      const result1 = await this.rootChain.exit(
        10 * 100,
        Scenario1.segments[0].toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        0,
        {
          from: operator,
          value: BOND
        });

      const challengeTx = Scenario1.blocks[0].signedTransactions[0]
      const result2 = await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].toBigNumber(),
        challengeTx.getTxBytes(),
        challengeTx.getProofAsHex(),
        challengeTx.getSignatures(),
        0,
        {
          from: bob,
          value: BOND
        });
      const exitId1 = result1.receipt.logs[0].args._exitId
      const exitId2 = result2.receipt.logs[0].args._exitId
      await this.rootChain.requestHigherPriorityExit(
        exitId2,
        exitId1,
        {
          from: alice
        });

      const respondTx = Scenario1.blocks[1].signedTransactions[0]
      await this.rootChain.challenge(
        exitId2,
        challengeTx.getTxBytes(),
        8 * 100 + 10,
        -1,
        Scenario1.segments[0].toBigNumber(),
        respondTx.getTxBytes(),
        respondTx.getProofAsHex(),
        respondTx.getSignatures(),
        {
          from: operator,
          gas: '500000'
        })
      const exitResult = await this.rootChain.getExit(exitId1)
      // challengeCount is 0
      assert.equal(exitResult[1].toNumber(), 0)
    })

    it("should success to challengeBefore by deposit transaction", async () => {
      const tx = Scenario1.blocks[0].signedTransactions[0]
      const result1 = await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        0,
        {
          from: bob,
          value: BOND
        });

      const depositTx = Scenario1.deposits[0]
      const result2 = await this.rootChain.exit(
        3 * 100,
        Scenario1.segments[0].toBigNumber(),
        depositTx.encode(),
        '0x',
        '0x',
        0,
        {
          from: alice,
          gas: '1000000',
          value: BOND
        });
      const exitId1 = result1.receipt.logs[0].args._exitId
      const exitId2 = result2.receipt.logs[0].args._exitId
      await this.rootChain.requestHigherPriorityExit(
        exitId2,
        exitId1,
        {
          from: alice
        });

      const respondTx = Scenario1.blocks[0].signedTransactions[0]
      await this.rootChain.challenge(
        exitId2,
        depositTx.encode(),
        6 * 100 + 10,
        -1,
        Scenario1.segments[0].toBigNumber(),
        respondTx.getTxBytes(),
        respondTx.getProofAsHex(),
        respondTx.getSignatures(),
        {
          from: operator,
          gas: '500000'
        })
      const exitResult = await this.rootChain.getExit(exitId1)
      // challengeCount is 0
      assert.equal(exitResult[1].toNumber(), 0)
    })

    it("should failed to finalizeExit", async () => {
      const tx = Scenario1.blocks[0].signedTransactions[0]
      const result1 = await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        0,
        {
          from: bob,
          value: BOND
        });
      const exitId1 = result1.receipt.logs[0].args._exitId
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      await this.rootChain.finalizeExit(
        exitableEnd,
        exitId1,
        {
          from: bob
        });
      const invalidTx = Scenario1.blocks[3].signedTransactions[0]
      const exitId2 = 2
      await this.rootChain.exit(
        12 * 100,
        Scenario1.segments[2].toBigNumber(),
        invalidTx.getTxBytes(),
        invalidTx.getProofAsHex(),
        invalidTx.getSignatures(),
        0,
        {
          from: operator,
          value: BOND
        });
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      await assertRevert(this.rootChain.finalizeExit(
        exitableEnd,
        exitId2,
        {
          from: bob
        }))
    })

  });

  describe("SplitTransaction", () => {

    const exitableEnd = ethers.utils.bigNumberify('4000000')

    beforeEach(async () => {
      await this.rootChain.deposit(
        {
          from: alice,
          value: '2000000000000000'
        });
      await this.rootChain.deposit(
        {
          from: bob,
          value: '2000000000000000'
        });
      const submit = async (root) => {
        await this.rootChain.submit(
          root,
          {
            from: operator
          });
      }
      await submit(Scenario3.blocks[0].block.getRoot())
      await submit(Scenario3.blocks[1].block.getRoot())
    })

    it("should success to exits diffirent UTXO with same transaction", async () => {
      const tx0 = Scenario3.blocks[0].signedTransactions[0][0]
      const tx1 = Scenario3.blocks[0].signedTransactions[0][1]
      const exitId = 1
      const result1 = await this.rootChain.exit(
        6 * 100,
        new Segment(ethers.utils.bigNumberify('0'), ethers.utils.bigNumberify('500000')).toBigNumber(),
        tx0.getTxBytes(),
        tx0.getProofAsHex(),
        tx0.getSignatures(),
        0,
        {
          from: alice,
          value: BOND
        });
      const result2 = await this.rootChain.exit(
        6 * 100 + 1,
        new Segment(ethers.utils.bigNumberify('500000'), ethers.utils.bigNumberify('1000000')).toBigNumber(),
        tx1.getTxBytes(),
        tx1.getProofAsHex(),
        tx1.getSignatures(),
        0,
        {
          from: bob,
          value: BOND
        });

      assert.equal(result1.logs[0].event, 'ExitStarted')
      assert.equal(result2.logs[0].event, 'ExitStarted')
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      await this.rootChain.finalizeExit(
        exitableEnd,
        exitId,
        {
          from: bob
        });
    })
  })

  describe("forceIncludeRequest", () => {

    const exitableEnd = ethers.utils.bigNumberify('2000000')

    beforeEach(async () => {
      await this.rootChain.deposit(
        {
          from: alice,
          value: '1000000000000000'
        });
      await this.rootChain.deposit(
        {
          from: operator,
          value: '1000000000000000'
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
        Scenario2.segments[3].toBigNumber(),
        tx1.getTxBytes(),
        tx1.getProofAsHex(),
        tx1.getSignatures(),
        0,
        {
          from: operator,
          value: BOND
        });
      const result2 = await this.rootChain.exit(
        8 * 100,
        Scenario2.segments[4].toBigNumber(),
        tx2.getTxBytes(),
        tx2.getProofAsHex(),
        tx2.getSignatures(),
        0,
        {
          from: operator,
          value: BOND
        });
      const result3 = await this.rootChain.exit(
        6 * 100 + 1,
        Scenario2.segments[4].toBigNumber(),
        forceIncludeTx.getTxBytes(),
        forceIncludeTx.getProofAsHex(),
        forceIncludeTx.getSignatures(),
        1,
        {
          from: alice,
          gas: '800000',
          value: BOND
        });
      const exitId2 = result2.receipt.logs[0].args._exitId
      const exitId3 = result3.receipt.logs[0].args._exitId
      await this.rootChain.requestHigherPriorityExit(
        exitId3,
        exitId2,
        {
          from: alice
        });

      // 6 weeks after
      await increaseTime(duration.weeks(6));
      // operator can't exit tx2
      await assertRevert(this.rootChain.finalizeExit(
        exitableEnd,
        exitId2,
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
        Scenario2.segments[3].toBigNumber(),
        tx1.getTxBytes(),
        tx1.getProofAsHex(),
        tx1.getSignatures(),
        0,
        {
          from: operator,
          value: BOND
        });
      await this.rootChain.exit(
        8 * 100,
        Scenario2.segments[4].toBigNumber(),
        tx2.getTxBytes(),
        tx2.getProofAsHex(),
        tx2.getSignatures(),
        0,
        {
          from: operator,
          value: BOND
        });
      const exitId = 2
      await this.rootChain.exit(
        6 * 100 + 1,
        Scenario2.segments[4].toBigNumber(),
        forceIncludeTx.getTxBytes(),
        forceIncludeTx.getProofAsHex(),
        forceIncludeTx.getSignatures(),
        1,
        {
          from: alice,
          value: BOND
        });
      const exitId3 = 3
      await this.rootChain.includeSignature(
        exitId3,
        6 * 100 + 1,
        Scenario2.segments[4].toBigNumber(),
        fullForceIncludeTx.getTxBytes(),
        fullForceIncludeTx.getProofAsHex(),
        fullForceIncludeTx.getSignatures(),
        {
          from: operator,
          gas: '800000'
        });
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      // operator can't exit tx2
      await assertRevert(this.rootChain.finalizeExit(
        exitableEnd,
        exitId,
        {
          from: operator
        }))
    })

  });

})
