import { describe, it } from "mocha"
import { SwapRequest } from "../../src/models/swap"
import { Segment } from "../../src/segment"
import { assert } from "chai"
import { constants, utils } from "ethers"
import { SwapTransaction } from '../../src/tx'
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
      segment1)
    assert.isTrue(swapRequest.check(segment2))
  })

  it('getSignedSwapTx', () => {
    const swapRequest = new SwapRequest(
      AliceAddress,
      blkNum,
      segment1,
      segment3)
    const tx = swapRequest.getSignedSwapTx(
      BobAddress,
      blkNum,
      segment2)
    const swapTx: SwapTransaction = tx.getRawTx() as SwapTransaction
    assert.equal(swapTx.getInput(0).getOwners()[0], AliceAddress)
    assert.equal(swapTx.getOutput(0).getOwners()[0], BobAddress)
  })

})
