import { describe, it } from "mocha"
import {
  Segment,
  TransactionDecoder,
  SplitTransaction,
  MergeTransaction,
  SwapTransaction,
  SignedTransaction,
  EscrowLockState,
  EscrowLockTransaction,
  EscrowUnlockTransaction,
  EscrowTimeoutTransaction
} from '../../../src'
import { assert } from "chai"
import { utils } from "ethers"
import {
  AlicePrivateKey,
  BobPrivateKey,
  CarlPrivateKey
} from "../../testdata"

describe('EscrowLockTransaction', () => {

  const AliceAddress = utils.computeAddress(AlicePrivateKey)
  const BobAddress = utils.computeAddress(BobPrivateKey)
  const CarlAddress = utils.computeAddress(CarlPrivateKey)
  const segment = Segment.ETH(
    utils.bigNumberify('2000000'),
    utils.bigNumberify('3000000'))
  const blkNum = utils.bigNumberify('1')
  const splitSegment = Segment.ETH(
    utils.bigNumberify('2000000'),
    utils.bigNumberify('2600000'))

  const segment1 = Segment.ETH(
    utils.bigNumberify('5000000'),
    utils.bigNumberify('6000000'))
  const segment2 = Segment.ETH(
    utils.bigNumberify('6000000'),
    utils.bigNumberify('7000000'))
  const blkNum1 = utils.bigNumberify('50')
  const blkNum2 = utils.bigNumberify('52')
  const timeoutBlkNum = utils.bigNumberify('53')
  const timeoutBlkNum2 = utils.bigNumberify('100')

  it('encode and decode lock transaction', () => {
    const tx = new EscrowLockTransaction(AliceAddress, segment, blkNum, BobAddress, BobAddress, timeoutBlkNum)
    const encoded = tx.encode()
    const decoded: EscrowLockTransaction = TransactionDecoder.decode(encoded) as EscrowLockTransaction
    //assert.equal(encoded, '0xf601b4f394953b8fb338ef870eda6d74c1dd4769b6c977b8cf831e8480832dc6c0019434fdeadc2b69fd24f3043a89f9231f10f1284a4a');
    assert.equal(decoded.label.toNumber(), 2);
    assert.equal(decoded.getOutput(0).getSegment(0).start.toString(), '2000000');
  });

  it('encode and decode unlock transaction', () => {
    const tx = new EscrowUnlockTransaction(AliceAddress, segment, blkNum, BobAddress, BobAddress, timeoutBlkNum)
    const encoded = tx.encode()
    const decoded: EscrowUnlockTransaction = TransactionDecoder.decode(encoded) as EscrowUnlockTransaction
    //assert.equal(encoded, '0xf83d03b83af83894953b8fb338ef870eda6d74c1dd4769b6c977b8cf834c4b40835b8d80836acfc09434fdeadc2b69fd24f3043a89f9231f10f1284a4a3234');
    assert.equal(decoded.getOutput(0).getSegment(0).start.toString(), '5000000')
    assert.equal(decoded.getInput().getSegment(0).start.toString(), '5000000')
  });

  it('encode and decode timeout transaction', () => {
    const tx = new EscrowTimeoutTransaction(AliceAddress, segment, blkNum, BobAddress, BobAddress, timeoutBlkNum)
    const encoded = tx.encode()
    const decoded: EscrowTimeoutTransaction = TransactionDecoder.decode(encoded) as EscrowTimeoutTransaction
    //assert.equal(encoded, '0xf84105b83ef83c94953b8fb338ef870eda6d74c1dd4769b6c977b8cf834c4b40835b8d80329434fdeadc2b69fd24f3043a89f9231f10f1284a4a835b8d80836acfc034');
    assert.equal(decoded.hash(), tx.hash());
    assert.equal(decoded.getOutput(0).getSegment(0).start.toString(), '5000000')
    assert.equal(decoded.getInput().getSegment(0).start.toString(), '5000000')
  });

  it('should have the same hash of the EscrowLockState', () => {
    const tx1 = new EscrowLockTransaction(AliceAddress, segment, blkNum, BobAddress, BobAddress, timeoutBlkNum)
    const tx2 = new EscrowUnlockTransaction(AliceAddress, segment, blkNum2, BobAddress, BobAddress, timeoutBlkNum)
    assert.equal(tx1.getOutput(0).withBlkNum(blkNum2).hash(), tx2.getInput().hash())
  });
    
  describe('SignedTransaction', () => {

    it('serialize and deserialize', () => {
      const tx = new EscrowTimeoutTransaction(AliceAddress, segment, blkNum, BobAddress, BobAddress, timeoutBlkNum)
      const signedTx = new SignedTransaction(tx)
      signedTx.sign(AlicePrivateKey)
      const serialized = signedTx.serialize()
      const deserialized = SignedTransaction.deserialize(serialized)
      assert.equal(deserialized.hash(), signedTx.hash())
      assert.equal(deserialized.getSignatures(), signedTx.getSignatures())
    });

    it('getSignatures', () => {
      const tx = new EscrowLockTransaction(AliceAddress, segment, blkNum, BobAddress, BobAddress, timeoutBlkNum)
      const signedTx = new SignedTransaction(tx)
      signedTx.sign(AlicePrivateKey)
      const signature = signedTx.getSignatures()
      assert.equal(utils.recoverAddress(signedTx.hash(), signature), AliceAddress)
    })

    it('should correctly verify lock transaction', () => {
      const tx = new EscrowLockTransaction(AliceAddress, segment, blkNum, BobAddress, BobAddress, timeoutBlkNum)
      const signedTxAlice = new SignedTransaction(tx)
      signedTxAlice.sign(AlicePrivateKey)
      const signedTxBob = new SignedTransaction(tx)
      signedTxBob.sign(BobPrivateKey)
      const signedTxCarl = new SignedTransaction(tx)
      signedTxCarl.sign(CarlPrivateKey)
      assert.equal(signedTxAlice.verify(), true)
      assert.equal(signedTxBob.verify(), false)
      assert.equal(signedTxCarl.verify(), false)
      assert.equal(SignedTransaction.deserialize(signedTxAlice.serialize()).verify(), true)
      assert.equal(SignedTransaction.deserialize(signedTxBob.serialize()).verify(), false)
      assert.equal(SignedTransaction.deserialize(signedTxCarl.serialize()).verify(), false)
    });
    it('should correctly verify unlock transaction', () => {
      const tx = new EscrowUnlockTransaction(AliceAddress, segment, blkNum, BobAddress, BobAddress, timeoutBlkNum)
      const signedTxAlice = new SignedTransaction(tx)
      signedTxAlice.sign(AlicePrivateKey)
      const signedTxBob = new SignedTransaction(tx)
      signedTxBob.sign(BobPrivateKey)
      const signedTxCarl = new SignedTransaction(tx)
      signedTxCarl.sign(CarlPrivateKey)
      assert.equal(signedTxAlice.verify(), false)
      assert.equal(signedTxBob.verify(), false)
      assert.equal(signedTxCarl.verify(), true)
      assert.equal(SignedTransaction.deserialize(signedTxAlice.serialize()).verify(), false)
      assert.equal(SignedTransaction.deserialize(signedTxBob.serialize()).verify(), false)
      assert.equal(SignedTransaction.deserialize(signedTxCarl.serialize()).verify(), true)
    });
    it('should fail to correctly verify unlock transaction after timeout', () => {
      const tx = new EscrowUnlockTransaction(AliceAddress, segment, blkNum, BobAddress, BobAddress, timeoutBlkNum2)
      const signedTxAlice = new SignedTransaction(tx)
      signedTxAlice.sign(AlicePrivateKey)
      const signedTxBob = new SignedTransaction(tx)
      signedTxBob.sign(BobPrivateKey)
      const signedTxCarl = new SignedTransaction(tx)
      signedTxCarl.sign(CarlPrivateKey)
      assert.equal(signedTxAlice.verify(), false)
      assert.equal(signedTxBob.verify(), false)
      assert.equal(signedTxCarl.verify(), true)
      assert.equal(SignedTransaction.deserialize(signedTxAlice.serialize()).verify(), false)
      assert.equal(SignedTransaction.deserialize(signedTxBob.serialize()).verify(), false)
      assert.equal(SignedTransaction.deserialize(signedTxCarl.serialize()).verify(), true)
    });
    it('should correctly verify timeout transaction', () => {
      const tx = new EscrowTimeoutTransaction(AliceAddress, segment, blkNum, BobAddress, BobAddress, timeoutBlkNum2)
      const signedTxAlice = new SignedTransaction(tx)
      signedTxAlice.sign(AlicePrivateKey)
      const signedTxBob = new SignedTransaction(tx)
      signedTxBob.sign(BobPrivateKey)
      const signedTxCarl = new SignedTransaction(tx)
      signedTxCarl.sign(CarlPrivateKey)

      assert.equal(signedTxAlice.verify(), true)
      assert.equal(signedTxBob.verify(), false)
      assert.equal(signedTxCarl.verify(), true)
      assert.equal(SignedTransaction.deserialize(signedTxAlice.serialize()).verify(), true)
      assert.equal(SignedTransaction.deserialize(signedTxBob.serialize()).verify(), false)
      assert.equal(SignedTransaction.deserialize(signedTxCarl.serialize()).verify(), true)
    });
    it('should fail to correctly verify timeout transaction before timeout', () => {
      const tx = new EscrowTimeoutTransaction(AliceAddress, segment, blkNum, BobAddress, BobAddress, timeoutBlkNum)
      // TODO: Need to set different timeout
      const signedTxAlice = new SignedTransaction(tx)
      signedTxAlice.sign(AlicePrivateKey)
      const signedTxBob = new SignedTransaction(tx)
      signedTxBob.sign(BobPrivateKey)
      const signedTxCarl = new SignedTransaction(tx)
      signedTxCarl.sign(CarlPrivateKey)

      assert.equal(signedTxAlice.verify(), true)
      assert.equal(signedTxBob.verify(), false)
      assert.equal(signedTxCarl.verify(), true)
      assert.equal(SignedTransaction.deserialize(signedTxAlice.serialize()).verify(), true)
      assert.equal(SignedTransaction.deserialize(signedTxBob.serialize()).verify(), false)
      assert.equal(SignedTransaction.deserialize(signedTxCarl.serialize()).verify(), true)
    });

  })
})
