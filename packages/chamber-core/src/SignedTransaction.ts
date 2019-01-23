import { utils } from "ethers"
import {
  BaseTransaction,
  TransactionDecoder
} from './tx'
import {
  HexString,
  Signature
} from './helpers/types';

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
    const key = new utils.SigningKey(pkey)
    this.signatures.push(utils.joinSignature(key.signDigest(this.tx.hash())))
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

  constructor(
    tx: BaseTransaction,
    proofs: HexString
  ) {
    super(tx)
    this.proofs = proofs
  }

  getProofs(): HexString {
    return this.proofs
  }

  merkleHash() {
    return this.tx.hash()
  }

}
