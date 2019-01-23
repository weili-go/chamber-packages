import { utils } from "ethers"
import {
  BaseTransaction,
  TransactionDecoder
} from './tx'
import {
  HexString,
  Signature,
  Hash
} from './helpers/types';
import { keccak256 } from 'ethers/utils';

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
export class SignedTransactionWithProof extends SignedTransaction {
  proofs: HexString
  root: Hash
  confSigs: Signature[]

  constructor(
    tx: BaseTransaction,
    root: Hash,
    proofs: HexString
  ) {
    super(tx)
    this.root = root
    this.proofs = proofs
    this.confSigs = []
  }

  getProofs(): HexString {
    return this.proofs
  }

  getSignatures() {
    return utils.hexlify(
      utils.concat(
        this.signatures.map(s => utils.arrayify(s)).concat(this.confSigs.map(s => utils.arrayify(s)))))
  }

  merkleHash(): Hash {
    return keccak256(
      utils.hexlify(
        utils.concat([
          utils.arrayify(this.tx.hash()),
          utils.arrayify(this.root)])))
  }

  confirmMerkleProofs(pkey: string) {
    const key = new utils.SigningKey(pkey)
    this.confSigs.push(utils.joinSignature(key.signDigest(this.merkleHash())))
  }

}
