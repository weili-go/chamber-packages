import { describe, it } from "mocha"
import {
  Segment,
  TransactionDecoder,
  TransferTransaction,
  SplitTransaction,
  MergeTransaction
} from '../src'
import { assert } from "chai"
import { utils } from "ethers"
import {
  AlicePrivateKey,
  BobPrivateKey
} from "./testdata"

describe('Transaction', () => {

  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const BobAddress = utils.computeAddress(BobPrivateKey)
  const segment = new Segment(
    utils.bigNumberify('2000000'),
    utils.bigNumberify('3000000'))
  const blkNum = utils.bigNumberify('1')
  const offset = utils.bigNumberify('2600000')

  const segment1 = new Segment(
    utils.bigNumberify('5000000'),
    utils.bigNumberify('6000000'))
  const segment2 = new Segment(
    utils.bigNumberify('6000000'),
    utils.bigNumberify('7000000'))
  const blkNum1 = utils.bigNumberify('50')
  const blkNum2 = utils.bigNumberify('52')


  it('encode and decode transfer transaction', () => {
    const tx = new TransferTransaction(AliceAddress, segment, blkNum, BobAddress)
    const encoded = tx.encode()
    const decoded: TransferTransaction = TransactionDecoder.decode(encoded) as TransferTransaction
    assert.equal(encoded, '0xf601b4f394953b8fb338ef870eda6d74c1dd4769b6c977b8cf831e8480832dc6c0019434fdeadc2b69fd24f3043a89f9231f10f1284a4a');
    assert.equal(decoded.getOutput().getSegment().start.toString(), '2000000');
  });

  it('encode and decode split transaction', () => {
    const tx = new SplitTransaction(
      AliceAddress, segment, blkNum, AliceAddress, BobAddress, offset)
    const encoded = tx.encode()
    const decoded: SplitTransaction = TransactionDecoder.decode(encoded) as SplitTransaction
    assert.equal(encoded, '0xf85102b84ef84c94953b8fb338ef870eda6d74c1dd4769b6c977b8cf831e8480832dc6c00194953b8fb338ef870eda6d74c1dd4769b6c977b8cf9434fdeadc2b69fd24f3043a89f9231f10f1284a4a8327ac40');
    assert.equal(decoded.getOutputWith(1).getSegment().start.toString(), '2600000');
  });

  it('encode and decode merge transaction', () => {
    const tx = new MergeTransaction(
      AliceAddress, segment1, segment2, blkNum1, blkNum2, BobAddress)
    const encoded = tx.encode()
    const decoded: MergeTransaction = TransactionDecoder.decode(encoded) as MergeTransaction
    assert.equal(encoded, '0xf84103b83ef83c94953b8fb338ef870eda6d74c1dd4769b6c977b8cf834c4b40835b8d80835b8d80836acfc032349434fdeadc2b69fd24f3043a89f9231f10f1284a4a');
    assert.equal(decoded.getOutput().getSegment().start.toString(), '5000000');
  });


})
