import { utils } from "ethers"
import {
  TransactionOutput
} from './txo'
import {
  MerkleProof
} from './merkle'
import { RLPItem } from './helpers/ethers'
import RLP = utils.RLP

export class Signature {

}

export type Argment = string

/**
 * raw transaction
 * inputs, outputs, verifier, label, args, nonce, maxBlock
 */
export class Transaction {
  args: Argment[]
  inputs: TransactionOutput[]
  outputs: TransactionOutput[]

  constructor(
    args: Argment[],
    inputs: TransactionOutput[],
    outputs: TransactionOutput[]
  ) {
    this.args = args
    this.inputs = inputs
    this.outputs = outputs
  }

  toTuple(): RLPItem[] {
    return [
      this.args,
      this.inputs.map(input => input.toTuple()),
      this.outputs.map(output => output.toTuple())
    ]
  }

  static fromTuple(tuple: RLPItem[]): Transaction {
    return new Transaction(
      tuple[0],
      tuple[1].map((t: RLPItem[]) => TransactionOutput.fromTuple(t)),
      tuple[2].map((t: RLPItem[]) => TransactionOutput.fromTuple(t))
    )
  }

  encode(): string {
    return RLP.encode(this.toTuple())
  }

  static decode(bytes: string): Transaction {
    return Transaction.fromTuple(RLP.decode(bytes))
  }
}

/**
 * SignedTransaction is the transaction and its signatures
 */
export class SignedTransaction extends Transaction {
  signatures: Signature[];

  constructor(
    args: Argment[],
    inputs: TransactionOutput[],
    outputs: TransactionOutput[],
    signatures: Signature[]
  ) {
    super(args, inputs, outputs)
    this.signatures = signatures
  }

}

/**
 * SignedTransactionWithProof is the transaction and its signatures and proof
 */
export class SignedTransactionWithProof extends SignedTransaction {
  proofs: MerkleProof[]

  constructor(
    args: Argment[],
    inputs: TransactionOutput[],
    outputs: TransactionOutput[],
    signatures: Signature[],
    proofs: MerkleProof[]
  ) {
    super(args, inputs, outputs, signatures)
    this.proofs = proofs
  }

}
