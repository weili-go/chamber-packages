import { describe, it } from "mocha"
import {
  Segment,
  Transaction,
  TransactionOutput
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

  it('encode empty transaction', () => {
    const tx = new Transaction([], [], [])
    const hex = tx.encode()
    assert.equal(hex, '0xc3c0c0c0');
  });

  it('encode and decode transfer transaction', () => {
    const AliceOwnState = TransactionOutput.own(AliceAddress, segment)
    const BobOwnState = TransactionOutput.own(BobAddress, segment)
    const tx = new Transaction([BobAddress], [AliceOwnState], [BobOwnState])
    const encoded = tx.encode()
    const decoded = Transaction.decode(encoded)
    assert.equal(encoded, '0xf85cd59434fdeadc2b69fd24f3043a89f9231f10f1284a4ae2e100d594953b8fb338ef870eda6d74c1dd4769b6c977b8cfc9c8831e8480832dc6c0e2e100d59434fdeadc2b69fd24f3043a89f9231f10f1284a4ac9c8831e8480832dc6c0');
    assert.equal(decoded.outputs[0].segments[0].start.toString(), '2000000');
  });

})
