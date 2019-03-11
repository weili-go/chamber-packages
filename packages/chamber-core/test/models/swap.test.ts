import { describe, it } from "mocha"
import { SwapRequest } from "../../src/models/swap"
import { Segment } from "../../src/segment"
import { assert } from "chai"
import { constants, utils } from "ethers"
import { OwnState, SwapTransaction } from '../../src/tx'
import {
  AlicePrivateKey,
  BobPrivateKey
} from "../testdata"

describe('SwapRequest', () => {

  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const BobAddress = utils.computeAddress(BobPrivateKey)
  const blkNum = constants.One
  const segment1 = Segment.ETH(
    utils.bigNumberify('1000000'),
    utils.bigNumberify('2000000'))
  const segment2 = Segment.ETH(
    utils.bigNumberify('2000000'),
    utils.bigNumberify('3000000'))
  const segment3 = Segment.ETH(
    utils.bigNumberify('4000000'),
    utils.bigNumberify('5000000'))

  it('check', () => {
    const swapRequest = new SwapRequest(
      AliceAddress,
      blkNum,
      segment3,
      blkNum,
      segment1)
    assert.isTrue(swapRequest.check(segment2))
  })

  it('getSignedSwapTx', () => {
    const swapRequest = new SwapRequest(
      AliceAddress,
      blkNum,
      segment1,
      blkNum,
      segment3)
    swapRequest.setTarget(new OwnState(
      segment2,
      BobAddress).withBlkNum(blkNum))
    const tx = swapRequest.getSignedSwapTx()
    assert.notEqual(tx, undefined)
    if(tx) {
      const swapTx: SwapTransaction = tx.getRawTx(0) as SwapTransaction
      assert.equal(swapTx.getInput(0).getOwners()[0], AliceAddress)
      assert.equal(swapTx.getOutput(0).getOwners()[0], BobAddress)
    }
  })

})
