import { describe, it } from "mocha"
import {
  Segment,
  TransactionDecoder,
  TransferTransaction,
  SplitTransaction,
  MergeTransaction,
  SwapTransaction,
  SignedTransaction,
  SignedTransactionWithProof
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
  const segment = Segment.ETH(
    utils.bigNumberify('2000000'),
    utils.bigNumberify('3000000'))
  const blkNum = utils.bigNumberify('1')
  const offset = utils.bigNumberify('2600000')

  const segment1 = Segment.ETH(
    utils.bigNumberify('5000000'),
    utils.bigNumberify('6000000'))
  const segment2 = Segment.ETH(
    utils.bigNumberify('6000000'),
    utils.bigNumberify('7000000'))
  const blkNum1 = utils.bigNumberify('50')
  const blkNum2 = utils.bigNumberify('52')

  it('encode and decode transfer transaction', () => {
    const tx = new TransferTransaction(AliceAddress, segment, blkNum, BobAddress)
    const encoded = tx.encode()
    const decoded: TransferTransaction = TransactionDecoder.decode(encoded) as TransferTransaction
    //assert.equal(encoded, '0xf601b4f394953b8fb338ef870eda6d74c1dd4769b6c977b8cf831e8480832dc6c0019434fdeadc2b69fd24f3043a89f9231f10f1284a4a');
    assert.equal(decoded.label.toNumber(), 1);
    assert.equal(decoded.getOutput().getSegment(0).start.toString(), '2000000');
  });

  it('encode and decode split transaction', () => {
    const tx = new SplitTransaction(
      AliceAddress, segment, blkNum, AliceAddress, BobAddress, offset)
    const encoded = tx.encode()
    const decoded: SplitTransaction = TransactionDecoder.decode(encoded) as SplitTransaction
    //assert.equal(encoded, '0xf85102b84ef84c94953b8fb338ef870eda6d74c1dd4769b6c977b8cf831e8480832dc6c00194953b8fb338ef870eda6d74c1dd4769b6c977b8cf9434fdeadc2b69fd24f3043a89f9231f10f1284a4a8327ac40');
    assert.equal(decoded.getOutput(1).getSegment(0).start.toString(), '2600000')
    assert.equal(decoded.getInput().getSegment(0).start.toString(), '2000000')
    assert.equal(tx.hash(), decoded.hash())

  });

  it('encode and decode merge transaction', () => {
    const tx = new MergeTransaction(
      AliceAddress, segment1, segment2, BobAddress, blkNum1, blkNum2)
    const encoded = tx.encode()
    const decoded: MergeTransaction = TransactionDecoder.decode(encoded) as MergeTransaction
    //assert.equal(encoded, '0xf83d03b83af83894953b8fb338ef870eda6d74c1dd4769b6c977b8cf834c4b40835b8d80836acfc09434fdeadc2b69fd24f3043a89f9231f10f1284a4a3234');
    assert.equal(decoded.getOutput().getSegment(0).start.toString(), '5000000')
    assert.equal(decoded.getInput(0).getSegment(0).start.toString(), '5000000')
  });

  it('encode and decode swap transaction', () => {
    const tx = new SwapTransaction(
      AliceAddress, segment1, blkNum1, BobAddress, segment2, blkNum2)
    const encoded = tx.encode()
    const decoded: SwapTransaction = TransactionDecoder.decode(encoded) as SwapTransaction
    //assert.equal(encoded, '0xf84105b83ef83c94953b8fb338ef870eda6d74c1dd4769b6c977b8cf834c4b40835b8d80329434fdeadc2b69fd24f3043a89f9231f10f1284a4a835b8d80836acfc034');
    assert.equal(decoded.hash(), tx.hash());
    assert.equal(decoded.getOutput(0).getSegment(0).start.toString(), '5000000')
    assert.equal(decoded.getInput(0).getSegment(0).start.toString(), '5000000')
  });

  it('hash of own state', () => {
    const tx1 = new TransferTransaction(AliceAddress, segment, blkNum1, BobAddress)
    const tx2 = new TransferTransaction(BobAddress, segment, blkNum2, AliceAddress)
    assert.equal(tx1.getOutput().withBlkNum(blkNum2).hash(), tx2.getInput().hash())
  });
    
  describe('SignedTransaction', () => {

    it('serialize and deserialize', () => {
      const tx = new TransferTransaction(AliceAddress, segment, blkNum, BobAddress)
      const signedTx = new SignedTransaction(tx)
      signedTx.sign(AlicePrivateKey)
      const serialized = signedTx.serialize()
      const deserialized = SignedTransaction.deserialize(serialized)
      assert.equal(deserialized.hash(), signedTx.hash())
      assert.equal(deserialized.getSignatures(), signedTx.getSignatures())
    });

    it('getSignatures', () => {
      const tx = new TransferTransaction(AliceAddress, segment, blkNum, BobAddress)
      const signedTx = new SignedTransaction(tx)
      signedTx.sign(AlicePrivateKey)
      const signature = signedTx.getSignatures()
      assert.equal(utils.recoverAddress(signedTx.hash(), signature), AliceAddress)
    })

    it('verify transfer transaction', () => {
      const tx = new TransferTransaction(AliceAddress, segment, blkNum, BobAddress)
      const signedTx = new SignedTransaction(tx)
      signedTx.sign(AlicePrivateKey)
      assert.equal(signedTx.verify(), true)
    });

    it('failed to verify transfer transaction', () => {
      const tx = new TransferTransaction(AliceAddress, segment, blkNum, BobAddress)
      const signedTx = new SignedTransaction(tx)
      signedTx.sign(BobPrivateKey)
      assert.equal(signedTx.verify(), false)
    });

    it('verify split transaction', () => {
      const tx = new SplitTransaction(
        AliceAddress, segment, blkNum, AliceAddress, BobAddress, offset)
      const signedTx = new SignedTransaction(tx)
      signedTx.sign(AlicePrivateKey)
      assert.equal(signedTx.verify(), true)
      assert.equal(SignedTransaction.deserialize(signedTx.serialize()).verify(), true)
    });

    it('verify merge transaction', () => {
      const tx = new MergeTransaction(
        AliceAddress, segment1, segment2, BobAddress, blkNum1, blkNum2)
      const signedTx = new SignedTransaction(tx)
      signedTx.sign(AlicePrivateKey)
      assert.equal(signedTx.verify(), true)
    });

    it('verify swap transaction', () => {
      const tx = new SwapTransaction(
        AliceAddress, segment1, blkNum1, BobAddress, segment2, blkNum2)
      const signedTx = new SignedTransaction(tx)
      signedTx.sign(AlicePrivateKey)
      signedTx.sign(BobPrivateKey)
      assert.equal(signedTx.verify(), true)
    });

  })

})
