import { describe, it } from "mocha"
import {
  Block,
  Segment,
  TransactionDecoder,
  TransferTransaction,
  SplitTransaction,
  MergeTransaction,
  SignedTransaction
} from '../src'
import { assert } from "chai"
import { constants, utils } from "ethers"
import {
  AlicePrivateKey,
  BobPrivateKey
} from "./testdata"
import { SignedTransactionWithProof } from '../dist';

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
  
  it('should create tree', () => {
    const rawTx1 = new TransferTransaction(AliceAddress, segment1, blkNum, BobAddress)
    const rawTx2 = new TransferTransaction(AliceAddress, segment3, blkNum, BobAddress)
    const tx1 = new SignedTransaction(rawTx1)
    const tx2 = new SignedTransaction(rawTx2)
    const block = new Block(2)
    block.appendTx(tx1)
    block.appendTx(tx2)
    assert.equal(block.createTree().getLeaves().length, 8)
    assert.equal(utils.hexlify(block.createTree().getLeaves()[2].getHash()), '0x290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563')
    const sptx1 = new SignedTransactionWithProof(rawTx1, block.getProof(rawTx1.hash()))
    const sptx2 = new SignedTransactionWithProof(rawTx2, block.getProof(rawTx2.hash()))

    assert.equal(block.checkInclusion(sptx1, segment1.start, segment1.end), true)
    assert.equal(block.checkInclusion(sptx2, segment3.start, segment3.end), true)
  });

})
