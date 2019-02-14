import { describe, it } from "mocha"
import {
  Block,
  Segment,
  TransactionDecoder,
  TransferTransaction,
  SplitTransaction,
  MergeTransaction,
  SignedTransaction,
  SignedTransactionWithProof
} from '../src'
import { assert } from "chai"
import { constants, utils } from "ethers"
import {
  AlicePrivateKey,
  BobPrivateKey
} from "./testdata"

describe('Block', () => {

  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const BobAddress = utils.computeAddress(BobPrivateKey)
  const blkNum = utils.bigNumberify('1')

  const segment1 = new Segment(
    utils.bigNumberify('5000000'),
    utils.bigNumberify('6000000'))
  const segment2 = new Segment(
    utils.bigNumberify('6000000'),
    utils.bigNumberify('7000000'))
  const segment3 = new Segment(
    utils.bigNumberify('7000000'),
    utils.bigNumberify('8000000'))

  const rawTx1 = new TransferTransaction(AliceAddress, segment1, blkNum, BobAddress)
  const rawTx2 = new TransferTransaction(AliceAddress, segment3, blkNum, BobAddress)
  const tx1 = new SignedTransaction(rawTx1)
  const tx2 = new SignedTransaction(rawTx2)
  tx1.sign(AlicePrivateKey)
  tx2.sign(AlicePrivateKey)

  it('should create tree', () => {
    const block = new Block()
    block.setBlockNumber(2)
    block.appendTx(tx1)
    block.appendTx(tx2)
    assert.equal(block.createTree().getLeaves().length, 8)
    assert.equal(utils.hexlify(block.createTree().getLeaves()[2].getHash()), '0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563')
    const sptx1 = block.getSignedTransactionWithProof(tx1.hash())[0]
    const sptx2 = block.getSignedTransactionWithProof(tx2.hash())[0]

    assert.equal(block.checkInclusion(sptx1, segment1.start, segment1.end), true)
    assert.equal(block.checkInclusion(sptx2, segment3.start, segment3.end), true)
  })

  it('should create tree for a tx', () => {
    const block = new Block()
    block.setBlockNumber(2)
    block.appendTx(tx1)
    assert.equal(block.createTree().getLeaves().length, 4)
    assert.equal(utils.hexlify(block.createTree().getLeaves()[2].getHash()), '0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563')
    const sptx1 = block.getSignedTransactionWithProof(tx1.hash())[0]

    assert.equal(block.checkInclusion(sptx1, segment1.start, segment1.end), true)
  })

  it('should getExclusionProof', () => {
    const block = new Block()
    block.setBlockNumber(2)
    block.appendTx(tx1)
    block.appendTx(tx2)
    const exclusionProof = block.getExclusionProof(utils.bigNumberify('3000000'))
    assert.equal(exclusionProof.index, 0)
    assert.equal(exclusionProof.segment.start.toNumber(), 0)
  })

  it('serialize and deserialize', () => {
    const block = new Block()
    block.setBlockNumber(2)
    block.appendTx(tx1)
    block.appendTx(tx2)
    const serialized = block.serialize()
    const deserialized = Block.deserialize(serialized)
    assert.equal(deserialized.number, block.number)
    assert.equal(deserialized.getRoot(), block.getRoot())
  })

  it('getUserTransactions', () => {
    const block = new Block()
    block.setBlockNumber(2)
    block.appendTx(tx1)
    block.appendTx(tx2)
    const bobTxs = block.getUserTransactions(BobAddress)
    assert.equal(bobTxs.length, 2)
  })

  it('getUserTransactionAndProofs', () => {
    const block = new Block()
    block.setBlockNumber(2)
    block.appendTx(tx1)
    block.appendTx(tx2)
    const bobTxs = block.getUserTransactionAndProofs(BobAddress)
    assert.equal(bobTxs.length, 2)
  })
  
  describe('SignedTransactionWithProof', () => {

    it('get merkleHash', () => {
      const block = new Block()
      block.setBlockNumber(2)
      block.appendTx(tx1)
      block.appendTx(tx2)
      const sinedTx = block.getSignedTransactionWithProof(rawTx1.hash())[0]
      assert.equal(sinedTx.merkleHash(), '0x2b5b36c65312b8cae51d05e26257bc43f89bc84f6ae511e01f5bc41c27d9630a')
    });

    it('serialize and deserialize', () => {
      const block = new Block()
      block.setBlockNumber(2)
      block.appendTx(tx1)
      block.appendTx(tx2)
      const sinedTx = block.getSignedTransactionWithProof(rawTx1.hash())[0]
      const deserialized = SignedTransactionWithProof.deserialize(sinedTx.serialize())
      assert.equal(deserialized.merkleHash(), sinedTx.merkleHash())
      assert.equal(deserialized.getProof().segment.toBigNumber().toString(), sinedTx.getProof().segment.toBigNumber().toString())
    });
  
  })

})
