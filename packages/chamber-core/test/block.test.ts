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
    const block = new Block(2)
    block.appendTx(tx1)
    block.appendTx(tx2)
    assert.equal(block.createTree().getLeaves().length, 8)
    assert.equal(utils.hexlify(block.createTree().getLeaves()[2].getHash()), '0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563')
    const sptx1 = new SignedTransactionWithProof(rawTx1, block.getRoot(), block.getProof(rawTx1.hash()))
    const sptx2 = new SignedTransactionWithProof(rawTx2, block.getRoot(), block.getProof(rawTx2.hash()))

    assert.equal(block.checkInclusion(sptx1, segment1.start, segment1.end), true)
    assert.equal(block.checkInclusion(sptx2, segment3.start, segment3.end), true)
  })

  it('serialize and deserialize', () => {
    const block = new Block(2)
    block.appendTx(tx1)
    block.appendTx(tx2)
    const serialized = block.serialize()
    const deserialized = Block.deserialize(serialized)
    assert.equal(deserialized.number, block.number)
    assert.equal(deserialized.getRoot(), block.getRoot())
  })

  describe('SignedTransactionWithProof', () => {

    it('get merkleHash', () => {
      const block = new Block(2)
      block.appendTx(tx1)
      block.appendTx(tx2)
      const sinedTx = new SignedTransactionWithProof(rawTx1, block.getRoot(), block.getProof(rawTx1.hash()))
      assert.equal(sinedTx.merkleHash(), '0xf6610ee09cafa15f998f19b9754864a671d56b8f353a98ac29893eb55db99989')
    });
  
  })

})
