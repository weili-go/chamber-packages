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
  const tx4 = SplitTransaction.Transfer(
    BobAddress,
    Segment.ETH(ethers.utils.bigNumberify(10000000), ethers.utils.bigNumberify(12000000)),
    ethers.utils.bigNumberify(6),
    AliceAddress
  )
  const tx5 = SplitTransaction.Transfer(
    BobAddress,
    Segment.ETH(ethers.utils.bigNumberify(12000000), ethers.utils.bigNumberify(15000000)),
    ethers.utils.bigNumberify(6),
    AliceAddress
  )


  const signedTx1 = new SignedTransaction([tx1])
  const signedTx2 = new SignedTransaction([tx2])
  const signedTx3 = new SignedTransaction([tx3])
  const signedTx4 = new SignedTransaction([tx4])
  const signedTx5 = new SignedTransaction([tx5])

  it('should succeed to insert', async () => {
    const segmentChecker = new SegmentChecker()
    const insertResults = segmentChecker.insert(signedTx1, utils.bigNumberify(6))
    assert.deepEqual(insertResults, [true])
    assert.isTrue(segmentChecker.isContain(signedTx2))
    assert.isTrue(segmentChecker.isContain(signedTx3))
  })

  it('should fail to insert twice', async () => {
    const segmentChecker = new SegmentChecker()
    segmentChecker.insert(signedTx1, utils.bigNumberify(6))
    const insertResults = segmentChecker.insert(signedTx1, utils.bigNumberify(6))
    assert.deepEqual(insertResults, [false])
    assert.equal(segmentChecker.leaves.length, 1)
  })

  it('should succeed to spend', async () => {
    const segmentChecker = new SegmentChecker()
    segmentChecker.insert(signedTx1, utils.bigNumberify(6))
    segmentChecker.spend(signedTx2)
    assert.equal(segmentChecker.leaves.length, 1)
    assert.isFalse(segmentChecker.isContain(signedTx2))
    assert.isTrue(segmentChecker.isContain(signedTx3))
  })

  it('should fail to spend twice', async () => {
    const segmentChecker = new SegmentChecker()
    segmentChecker.insert(signedTx1, utils.bigNumberify(6))
    segmentChecker.spend(signedTx2)
    const spendResults = segmentChecker.spend(signedTx2)
    assert.equal(segmentChecker.leaves.length, 1)
    assert.deepEqual(spendResults, [false])
    assert.isFalse(segmentChecker.isContain(signedTx2))
    assert.isTrue(segmentChecker.isContain(signedTx3))
  })

  it('should be ordered', async () => {
    const segmentChecker = new SegmentChecker()
    segmentChecker.insert(signedTx2, utils.bigNumberify(6))
    segmentChecker.insert(signedTx3, utils.bigNumberify(6))
    segmentChecker.insert(signedTx5, utils.bigNumberify(8))
    segmentChecker.insert(signedTx4, utils.bigNumberify(10))
    assert.equal(segmentChecker.leaves[0].getSegment(0).start.toString(), '0')
    assert.equal(segmentChecker.leaves[3].getSegment(0).start.toString(), '12000000')
  })

})
