import { describe, it } from "mocha"
import { assert } from "chai"
import { constants, utils, ethers } from "ethers"
import { SegmentChecker } from '../src/SegmentChecker'
import { SplitTransaction, Segment, SignedTransaction } from '@layer2/core'

describe('SegmentChecker', () => {

  const AlicePrivateKey = '0xe88e7cda6f7fae195d0dcda7ccb8d733b8e6bb9bd0bc4845e1093369b5dc2257'
  const BobPrivateKey = '0x855364a82b6d1405211d4b47926f4aa9fa55175ab2deaf2774e28c2881189cff'
  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const BobAddress = utils.computeAddress(BobPrivateKey)

  const tx1 = SplitTransaction.Transfer(
    AliceAddress,
    Segment.ETH(ethers.utils.bigNumberify(0), ethers.utils.bigNumberify(10000000)),
    ethers.utils.bigNumberify(5),
    BobAddress
  )
  const tx2 = SplitTransaction.Transfer(
    BobAddress,
    Segment.ETH(ethers.utils.bigNumberify(2000000), ethers.utils.bigNumberify(10000000)),
    ethers.utils.bigNumberify(6),
    AliceAddress
  )
  const tx3 = SplitTransaction.Transfer(
    BobAddress,
    Segment.ETH(ethers.utils.bigNumberify(0), ethers.utils.bigNumberify(2000000)),
    ethers.utils.bigNumberify(6),
    AliceAddress
  )

  const signedTx1 = new SignedTransaction(tx1)
  const signedTx2 = new SignedTransaction(tx2)
  const signedTx3 = new SignedTransaction(tx3)

  it('should success to insert', async () => {
    const segmentChecker = new SegmentChecker()
    const insertResults = segmentChecker.insert(signedTx1, utils.bigNumberify(6))
    assert.deepEqual(insertResults, [true])
    assert.isTrue(segmentChecker.isContain(signedTx2))
    assert.isTrue(segmentChecker.isContain(signedTx3))
  })

  it('should failed to insert twice', async () => {
    const segmentChecker = new SegmentChecker()
    segmentChecker.insert(signedTx1, utils.bigNumberify(6))
    const insertResults = segmentChecker.insert(signedTx1, utils.bigNumberify(6))
    assert.deepEqual(insertResults, [false])
    assert.equal(segmentChecker.leaves.length, 1)
  })

  it('should success to spent', async () => {
    const segmentChecker = new SegmentChecker()
    segmentChecker.insert(signedTx1, utils.bigNumberify(6))
    segmentChecker.spent(signedTx2)
    assert.equal(segmentChecker.leaves.length, 1)
    assert.isFalse(segmentChecker.isContain(signedTx2))
    assert.isTrue(segmentChecker.isContain(signedTx3))
  })

  it('should failed to spent twice', async () => {
    const segmentChecker = new SegmentChecker()
    segmentChecker.insert(signedTx1, utils.bigNumberify(6))
    segmentChecker.spent(signedTx2)
    const spentResults = segmentChecker.spent(signedTx2)
    assert.equal(segmentChecker.leaves.length, 1)
    assert.deepEqual(spentResults, [false])
    assert.isFalse(segmentChecker.isContain(signedTx2))
    assert.isTrue(segmentChecker.isContain(signedTx3))
  })


})
