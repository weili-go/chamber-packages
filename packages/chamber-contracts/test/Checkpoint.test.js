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
const Checkpoint = artifacts.require("Checkpoint")
const TransactionVerifier = artifacts.require("TransactionVerifier")
const StandardVerifier = artifacts.require("StandardVerifier")
const MultisigVerifier = artifacts.require("MultisigVerifier")
const ERC721 = artifacts.require("ERC721")
const ethers = require('ethers')
const utils = ethers.utils
const BigNumber = utils.BigNumber

const {
  constants,
  Segment
} = require('@layer2/core')

const {
  Scenario1,
  testKeys,
  testAddresses
} = require('./testdata')

require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const EXIT_BOND = constants.EXIT_BOND
const CHECKPOINT_BOND = constants.CHECKPOINT_BOND

function getPermission(target, blkNum, segment) {
  return utils.hexlify(utils.concat([
    utils.arrayify(utils.keccak256(utils.toUtf8Bytes('checkpoint'))),
    utils.padZeros(utils.arrayify(target), 32),
    utils.padZeros(utils.arrayify(blkNum), 32),
    utils.padZeros(utils.arrayify(segment), 32)
  ]))
}

contract("Checkpoint", ([alice, bob, operator, user4, user5, admin]) => {

  beforeEach(async () => {
    this.erc721 = await ERC721.new()
    this.checkpoint = await Checkpoint.new({ from: operator })
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
      this.erc721.address,
      this.checkpoint.address,
      {
        from: operator
      })
    await this.rootChain.setup()
    await this.checkpoint.setRootChain(this.rootChain.address)
  });

  describe("requestCheckpoint", () => {

    const exitableEnd = Scenario1.segments[1].end
    const checkpointId = utils.bigNumberify(1)
    const checkpointBlkNum = utils.bigNumberify(14)
    const checkpointSegment = Segment.ETH(
      utils.bigNumberify('0'),
      utils.bigNumberify('3000000'))

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
      const submit = async (block) => {
        const result = await this.rootChain.submit(
          block.getRoot(),
          {
            from: operator
          });
        block.setBlockTimestamp(utils.bigNumberify(result.logs[0].args._timestamp.toString()))
        block.setSuperRoot(result.logs[0].args._superRoot)
      }
      await submit(Scenario1.blocks[0].block)
      await submit(Scenario1.blocks[1].block)
      await submit(Scenario1.blocks[2].block)
      await submit(Scenario1.blocks[3].block)
    })

    it("should success to request checkpoint", async () => {
      await this.checkpoint.requestCheckpoint(
        checkpointBlkNum,
        checkpointSegment.toBigNumber(),
        {
          from: operator,
          value: CHECKPOINT_BOND
        });
      await increaseTime(duration.weeks(4 * 3 + 1))
      const isSuccess = await this.checkpoint.finalizeCheckpoint.call(
        checkpointId,
        {
          from: operator
        });
      assert.isTrue(isSuccess)

    })

    it("should success to challenge checkpoint", async () => {
      await this.checkpoint.requestCheckpoint(
        checkpointBlkNum,
        checkpointSegment.toBigNumber(),
        {
          from: operator,
          value: CHECKPOINT_BOND
        });
      const tx = Scenario1.blocks[0].block.getSignedTransactionWithProof(
        Scenario1.blocks[0].transactions[0].hash())[0]
      const result = await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        0,
        {
          from: bob,
          value: EXIT_BOND
        });
      const exitId = result.receipt.logs[0].args._exitId
      // 14 weeks after
      await increaseTime(duration.weeks(4 * 3 + 2))
      await this.rootChain.finalizeExit(
        exitableEnd,
        exitId,
        {
          from: bob
        });
      await this.checkpoint.challengeCheckpoint(
        checkpointId,
        exitId,
        {
          from: bob
        });
      await assertRevert(this.checkpoint.challengeCheckpoint(
        checkpointId,
        exitId,
        {
          from: bob
        }))

      const getCheckpointResult = await this.checkpoint.getRequestingCheckpoint.call(
        checkpointId,
        {
          from: bob
        });
      assert.equal(getCheckpointResult[2].toNumber(), 1)

      const isSuccess = await this.checkpoint.finalizeCheckpoint.call(
        checkpointId,
        {
          from: operator
        });
      assert.isFalse(isSuccess)
    })

    it("should success to respond challenge checkpoint", async () => {
      await this.checkpoint.requestCheckpoint(
        checkpointBlkNum,
        checkpointSegment.toBigNumber(),
        {
          from: operator,
          value: CHECKPOINT_BOND
        });
      const tx = Scenario1.blocks[0].block.getSignedTransactionWithProof(
        Scenario1.blocks[0].transactions[0].hash())[0]
      const result = await this.rootChain.exit(
        6 * 100,
        Scenario1.segments[0].toBigNumber(),
        tx.getTxBytes(),
        tx.getProofAsHex(),
        tx.getSignatures(),
        0,
        {
          from: bob,
          value: EXIT_BOND
        });
      const exitId = result.receipt.logs[0].args._exitId
      // 14 weeks after
      await increaseTime(duration.weeks(4 * 3 + 2))
      await this.rootChain.finalizeExit(
        exitableEnd,
        exitId,
        {
          from: bob
        });
      await this.checkpoint.challengeCheckpoint(
        checkpointId,
        exitId,
        {
          from: bob
        });
      const permission = getPermission(operator, checkpointBlkNum, checkpointSegment.toBigNumber())
      const bobKey = new utils.SigningKey(testKeys.BobPrivateKey)
      const sigs = utils.joinSignature(bobKey.signDigest(utils.keccak256(permission)))
      await this.checkpoint.respondChallengeCheckpoint(
        checkpointId,
        exitId,
        permission,
        sigs,
        {
          from: operator
        });
      await assertRevert(this.checkpoint.respondChallengeCheckpoint(
        checkpointId,
        exitId,
        permission,
        sigs,
        {
          from: operator
        }))
      const getCheckpointResult = await this.checkpoint.getRequestingCheckpoint.call(
        checkpointId,
        {
          from: operator
        });
      assert.equal(getCheckpointResult[2].toNumber(), 0)
      
      const isSuccess = await this.checkpoint.finalizeCheckpoint.call(
        checkpointId,
        {
          from: operator
        });
      assert.isTrue(isSuccess)
    })

  });

})
