import { utils } from "ethers"
import {
  BaseTransaction,
  TransactionDecoder,
  TransactionOutput
} from './tx'
import {
  HexString,
  Signature,
  Hash
} from './helpers/types'
import { keccak256, BigNumber } from 'ethers/utils'
import {
  SumMerkleProof
} from './merkle'

/**
 * SignedTransaction is the transaction and its signatures
 */
export class SignedTransaction {
  tx: BaseTransaction
  signatures: Signature[]

  constructor(
    tx: BaseTransaction
  ) {
    this.tx = tx
    this.signatures = []
  }

  withRawSignatures(sigs: Signature[]): SignedTransaction {
    this.signatures = sigs
    return this
  }

  getRawTx() {
    return this.tx
  }

  verify(): boolean {
    return this.tx.verify(this.signatures)
  }

  /**
   * sign
   * @param pkey is hex string of private key
   */
  sign(pkey: string) {
    this.signatures.push(this.justSign(pkey))
  }

  justSign(pkey: string) {
    const key = new utils.SigningKey(pkey)
    return utils.joinSignature(key.signDigest(this.tx.hash()))
  }

  toHex() {
    return this.tx.encode()
  }

  hash() {
    return this.tx.hash()
  }

  getSegments() {
    return this.tx.getSegments()
  }

  getSignatures() {
    return utils.hexlify(utils.concat(this.signatures.map(s => utils.arrayify(s))))
  }

  serialize() {
    return {
      rawTx: this.toHex(),
      sigs: this.signatures
    }
  }

  static deserialize(data: any): SignedTransaction {
    return new SignedTransaction(TransactionDecoder.decode(data.rawTx))
      .withRawSignatures(data.sigs)
  }

}

/**
 * SignedTransactionWithProof is the transaction and its signatures and proof
 */
export class SignedTransactionWithProof {
  signedTx: SignedTransaction
  outputIndex: number
  proof: SumMerkleProof
  root: Hash
  blkNum: BigNumber
  confSigs: Signature[]

  constructor(
    tx: SignedTransaction,
    outputIndex: number,
    root: Hash,
    proof: SumMerkleProof,
    blkNum: BigNumber
  ) {
    this.signedTx = tx
    this.outputIndex = outputIndex
    this.root = root
    this.proof = proof
    this.blkNum = blkNum
    this.confSigs = []
  }

  withRawConfSigs(sigs: Signature[]): SignedTransactionWithProof {
    this.confSigs = sigs
    return this
  }

  getSignedTx(): SignedTransaction {
    return this.signedTx
  }

  getTxBytes(): HexString {
    return this.getSignedTx().toHex()
  }

  getTxHash(): Hash {
    return this.getSignedTx().hash()
  }

  getProof(): SumMerkleProof {
    return this.proof
  }

  getProofAsHex(): HexString {
    return this.proof.proof
  }

  getSignatures(): HexString {
    return utils.hexlify(
      utils.concat(
        this.signedTx.signatures.map(s => utils.arrayify(s)).concat(this.confSigs.map(s => utils.arrayify(s)))))
  }

  getOutput() {
    return this.signedTx.tx.getOutput(this.outputIndex).withBlkNum(this.blkNum)
  }

  merkleHash(): Hash {
    return keccak256(
      utils.hexlify(
        utils.concat([
          utils.arrayify(this.signedTx.hash()),
          utils.arrayify(this.root)])))
  }

  confirmMerkleProofs(pkey: string) {
    const key = new utils.SigningKey(pkey)
    this.confSigs.push(utils.joinSignature(key.signDigest(this.merkleHash())))
  }

  serialize() {
    return {
      signedTx: this.getSignedTx().serialize(),
      outputIndex: this.outputIndex,
      root: this.root,
      proof: this.proof.serialize(),
      blkNum: this.blkNum,
      confSigs: this.confSigs
    }
  }

  static deserialize(data: any): SignedTransactionWithProof {
    return new SignedTransactionWithProof(
      SignedTransaction.deserialize(data.signedTx),
      data.outputIndex,
      data.root,
      SumMerkleProof.deserialize(data.proof),
      data.blkNum
    ).withRawConfSigs(data.confSigs)
  }

}
