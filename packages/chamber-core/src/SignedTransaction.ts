import { utils } from "ethers"
import {
  BaseTransaction,
  TransactionDecoder,
  TransactionOutput,
  SwapTransaction
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
    this.signatures = this.getRawTx().normalizeSigs(this.signatures)
  }

  justSign(pkey: string) {
    const key = new utils.SigningKey(pkey)
    return utils.joinSignature(key.signDigest(this.tx.hash()))
  }

  getTxBytes() {
    return this.toHex()
  }

  getTxHash() {
    return this.hash()
  }

  /**
   * @deprecated
   */
  toHex() {
    return this.tx.encode()
  }

  /**
   * @deprecated
   */
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
  superRoot: Hash
  root: Hash
  timestamp: BigNumber
  blkNum: BigNumber
  confSigs: Signature[]

  constructor(
    tx: SignedTransaction,
    outputIndex: number,
    superRoot: Hash,
    root: Hash,
    timestamp: BigNumber,
    proof: SumMerkleProof,
    blkNum: BigNumber
  ) {
    this.signedTx = tx
    this.outputIndex = outputIndex
    this.superRoot = superRoot
    this.root = root
    this.timestamp = timestamp
    this.proof = proof
    this.blkNum = blkNum
    this.confSigs = []
  }

  withRawConfSigs(sigs: Signature[]): SignedTransactionWithProof {
    this.confSigs = sigs
    return this
  }

  requireConfsig() {
    return this.getSignedTx().getRawTx().requireConfsig()
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

  getSuperRoot() {
    return this.superRoot
  }

  getRoot() {
    return this.root
  }

  getProof(): SumMerkleProof {
    return this.proof
  }

  getProofAsHex(): HexString {
    const rootHeader = utils.arrayify(this.root)
    const timestampHeader = utils.padZeros(utils.arrayify(this.timestamp), 8)
    const body = utils.arrayify(this.proof.toHex())
    return utils.hexlify(utils.concat([rootHeader, timestampHeader, body]))
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
          utils.arrayify(this.superRoot)])))
  }

  confirmMerkleProofs(pkey: string) {
    const key = new utils.SigningKey(pkey)
    const merkleHash = this.merkleHash()
    this.confSigs.push(utils.joinSignature(key.signDigest(merkleHash)))
    this.confSigs = this.getSignedTx().getRawTx().normalizeSigs(this.confSigs, merkleHash)
  }

  serialize() {
    return {
      signedTx: this.getSignedTx().serialize(),
      outputIndex: this.outputIndex,
      superRoot: this.superRoot,
      root: this.root,
      timestamp: this.timestamp.toString(),
      proof: this.proof.serialize(),
      blkNum: this.blkNum.toString(),
      confSigs: this.confSigs
    }
  }

  static deserialize(data: any): SignedTransactionWithProof {
    return new SignedTransactionWithProof(
      SignedTransaction.deserialize(data.signedTx),
      data.outputIndex,
      data.superRoot,
      data.root,
      utils.bigNumberify(data.timestamp),
      SumMerkleProof.deserialize(data.proof),
      utils.bigNumberify(data.blkNum)
    ).withRawConfSigs(data.confSigs)
  }

}
