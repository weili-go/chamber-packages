// const { injectInTruffle } = require('sol-trace');
// injectInTruffle(web3, artifacts);
const { deployRLPdecoder } = require('./helpers/deployRLPdecoder')
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
const ethers = require('ethers')
const BigNumber = ethers.utils.BigNumber

const {
  constants
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
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        {
          from: bob,
          value: BOND
        });
      // gas cost of exit is 116480
      console.log('gasCost', gasCost)
      const result = await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        {
          from: bob,
          value: BOND
        });
      assert.equal(result.logs[0].event, 'ExitStarted')
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      await this.rootChain.finalizeExit(
        tx.signedTx.tx.getOutput().hash(6),
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
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        {
          from: bob,
          value: BOND
        });
      const challengeTx = Scenario1.blocks[1].signedTransactions[0]
      await this.rootChain.challenge(
        tx.signedTx.tx.getOutput().hash(6),
        tx.getTxBytes(),
        8 * 100 + 10,
        -1,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
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
      await this.rootChain.exit(
        10 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        {
          from: operator,
          value: BOND
        });

      const challengeTx = Scenario1.blocks[1].signedTransactions[0]
      const exitHash = tx.signedTx.tx.getOutput().hash(10)
      await this.rootChain.challengeBefore(
        exitHash,
        8 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        challengeTx.getTxBytes(),
        challengeTx.getTxHash(),
        challengeTx.getProofAsHex(),
        challengeTx.getSignatures(),
        {
          from: alice,
          gas: '500000',
          value: BOND
        });
      // 6 weeks after
      const exitResult = await this.rootChain.getExit(exitHash)
      // challengeCount is 1
      assert.equal(exitResult[1].toNumber(), 1)
      await increaseTime(duration.weeks(6))
      await assertRevert(this.rootChain.finalizeExit(
        exitHash,
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
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        {
          from: operator,
          value: BOND
        });

      const challengeTx = Scenario1.blocks[0].signedTransactions[0]
      const exitHash = tx.signedTx.tx.getOutput().hash(10)
      await this.rootChain.challengeBefore(
        exitHash,
        6 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        challengeTx.getTxBytes(),
        challengeTx.getTxHash(),
        challengeTx.getProofAsHex(),
        challengeTx.getSignatures(),
        {
          from: bob,
          gas: '500000',
          value: BOND
        });
      const respondTx = Scenario1.blocks[1].signedTransactions[0]
      await this.rootChain.respondChallenge(
        challengeTx.getTxBytes(),
        8 * 100 + 10,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        respondTx.getTxBytes(),
        respondTx.getProofAsHex(),
        respondTx.getSignatures(),
        {
          from: operator,
          gas: '500000'
        });
      const exitResult = await this.rootChain.getExit(exitHash)
      // challengeCount is 0
      assert.equal(exitResult[1].toNumber(), 0)
    })

    it("should success to challengeBefore by deposit transaction", async () => {
      const tx = Scenario1.blocks[0].signedTransactions[0]
      await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        {
          from: bob,
          value: BOND
        });

      const depositTx = Scenario1.deposits[0]
      const exitHash = tx.signedTx.tx.getOutput().hash(6)
      await this.rootChain.challengeBefore(
        exitHash,
        3 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        depositTx.encode(),
        depositTx.hash(),
        '0x',
        '0x',
        {
          from: alice,
          gas: '500000',
          value: BOND
        });
      const respondTx = Scenario1.blocks[0].signedTransactions[0]
      await this.rootChain.respondChallenge(
        depositTx.encode(),
        6 * 100 + 10,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        respondTx.getTxBytes(),
        respondTx.getProofAsHex(),
        respondTx.getSignatures(),
        {
          from: bob,
          gas: '500000'
        });
      const exitResult = await this.rootChain.getExit(exitHash)
      // challengeCount is 0
      assert.equal(exitResult[1].toNumber(), 0)
    })

    it("should success to challengeByWithdrawal", async () => {
      const tx = Scenario1.blocks[0].signedTransactions[0]
      await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].start,
        Scenario1.segments[0].end,
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        {
          from: bob,
          value: BOND
        });
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      await this.rootChain.finalizeExit(
        tx.signedTx.tx.getOutput().hash(6),
        {
          from: bob
        });
      const invalidTx = Scenario1.blocks[3].signedTransactions[0]
      await this.rootChain.exit(
        12 * 100,
        Scenario1.segments[2].start,
        Scenario1.segments[2].end,
        invalidTx.getTxBytes(),
        invalidTx.getProofAsHex(),
        invalidTx.getSignatures(),
        {
          from: operator,
          value: BOND
        });
      await this.rootChain.challengeByWithdrawal(
        invalidTx.signedTx.tx.getOutput().hash(12),
        Scenario1.segments[0].toBigNumber(),
        {
          from: bob
        });
    
    })

  });

  describe("SplitTransaction", () => {

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
      await submit(Scenario3.blocks[0].block.getRoot())
      await submit(Scenario3.blocks[1].block.getRoot())
    })

    it("should success to exits diffirent UTXO with same transaction", async () => {
      const tx0 = Scenario3.blocks[0].signedTransactions[0][0]
      const tx1 = Scenario3.blocks[0].signedTransactions[0][1]
      const result1 = await this.rootChain.exit(
        6 * 100,
        ethers.utils.bigNumberify('0'),
        ethers.utils.bigNumberify('500000'),
        tx0.getTxBytes(),
        tx0.getProofAsHex(),
        tx0.getSignatures(),
        {
          from: alice,
          value: BOND
        });
      const result2 = await this.rootChain.exit(
        6 * 100 + 1,
        ethers.utils.bigNumberify('500000'),
        ethers.utils.bigNumberify('1000000'),
        tx1.getTxBytes(),
        tx1.getProofAsHex(),
        tx1.getSignatures(),
        {
          from: bob,
          value: BOND
        });

      assert.equal(result1.logs[0].event, 'ExitStarted')
      assert.equal(result2.logs[0].event, 'ExitStarted')
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      await this.rootChain.finalizeExit(
        tx0.signedTx.tx.getOutputWith(0).hash(6),
        {
          from: bob
        });
    })
  })

  describe("forceIncludeRequest", () => {

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
        tx1.getTxBytes(),
        tx1.getProofAsHex(),
        tx1.getSignatures(),
        {
          from: operator,
          value: BOND
        });
      await this.rootChain.exit(
        8 * 100,
        Scenario2.segments[4].start,
        Scenario2.segments[4].end,
        tx2.getTxBytes(),
        tx2.getProofAsHex(),
        tx2.getSignatures(),
        {
          from: operator,
          value: BOND
        });
      const exitHash = tx2.signedTx.tx.getOutput().hash(8)
      await this.rootChain.forceIncludeRequest(
        exitHash,
        6 * 100 + 1,
        Scenario2.segments[4].start,
        Scenario2.segments[4].end,
        forceIncludeTx.getTxBytes(),
        forceIncludeTx.getProofAsHex(),
        forceIncludeTx.getSignatures(),
        0,
        {
          from: alice,
          gas: '800000',
          value: BOND
        });
      // 6 weeks after
      await increaseTime(duration.weeks(6));
      // operator can't exit tx2
      await assertRevert(this.rootChain.finalizeExit(
        exitHash,
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
        tx1.getTxBytes(),
        tx1.getProofAsHex(),
        tx1.getSignatures(),
        {
          from: operator,
          value: BOND
        });
      await this.rootChain.exit(
        8 * 100,
        Scenario2.segments[4].start,
        Scenario2.segments[4].end,
        tx2.getTxBytes(),
        tx2.getProofAsHex(),
        tx2.getSignatures(),
        {
          from: operator,
          value: BOND
        });
      const exitHash = tx2.signedTx.tx.getOutput().hash(8)
      await this.rootChain.forceIncludeRequest(
        exitHash,
        6 * 100 + 1,
        Scenario2.segments[4].start,
        Scenario2.segments[4].end,
        forceIncludeTx.getTxBytes(),
        forceIncludeTx.getProofAsHex(),
        forceIncludeTx.getSignatures(),
        0,
        {
          from: alice,
          value: BOND
        });
      await this.rootChain.includeSignature(
        6 * 100 + 1,
        Scenario2.segments[4].start,
        Scenario2.segments[4].end,
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
        exitHash,
        {
          from: operator
        }))
    })

  });

})
