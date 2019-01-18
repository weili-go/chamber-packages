import { utils } from "ethers"
import {
  Segment
} from './segment'
import {
  MerkleProof
} from './merkle'
import { RLPItem } from './helpers/ethers'
import RLP = utils.RLP
import { BigNumber } from 'ethers/utils';

export type Signature = string
export type LockState = string
export type Address = string
export type Uint256 = BigNumber
export type RLPItem = Address | Uint256
export type RLPTx = RLPItem[]

/**
 * BaseTransaction is raw transaction data structure
 */
export class BaseTransaction {

  items: RLPTx

  constructor(items: RLPTx) {
    this.items = items
  }

  toTuple(): RLPItem[] {
    return this.items
  }

  encode(): string {
    return RLP.encode(this.toTuple())
  }

  static fromTuple(tuple: RLPItem[]): BaseTransaction {
    return new BaseTransaction(tuple)
  }

  static decode(bytes: string): BaseTransaction {
    return BaseTransaction.fromTuple(RLP.decode(bytes))
  }

  verify(): boolean {
    return false
  }

  getOutput() {

  }
}

class TransactionOutput {
  segment: Segment
  owner: Address

  constructor(
    segment: Segment,
    owner: Address
  ) {
    this.segment = segment
    this.owner = owner
  }

  getSegment() {
    return this.segment
  }
}

export class TransferTransaction extends BaseTransaction {
  from: Address
  segment: Segment
  blkNum: Uint256
  to: Address

  constructor(
    from: Address,
    segment: Segment,
    blkNum: Uint256,
    to: Address
  ) {
    super([from, segment.start, segment.end, blkNum, to])
    this.from = from
    this.segment = segment
    this.blkNum = blkNum
    this.to = to
  }

  static fromTuple(tuple: RLPItem[]): TransferTransaction {
    return new TransferTransaction(tuple[0], Segment.fromTuple(tuple.slice(1, 3)), tuple[3], tuple[4])
  }

  static decode(bytes: string): TransferTransaction {
    return TransferTransaction.fromTuple(RLP.decode(bytes))
  }

  getOutput(): TransactionOutput {
    return new TransactionOutput(
      this.segment,
      this.to
    )
  }

}

export class SplitTransaction extends BaseTransaction {
  from: Address
  segment: Segment
  blkNum: Uint256
  to1: Address
  to2: Address
  offset: Uint256

  constructor(
    from: Address,
    segment: Segment,
    blkNum: Uint256,
    to1: Address,
    to2: Address,
    offset: Uint256,
  ) {
    super([from, segment.start, segment.end, blkNum, to1, to2, offset])
    this.from = from
    this.segment = segment
    this.blkNum = blkNum
    this.to1 = to1
    this.to2 = to2
    this.offset = offset
  }

  static fromTuple(tuple: RLPItem[]): SplitTransaction {
    return new SplitTransaction(
      tuple[0],
      Segment.fromTuple(tuple.slice(1, 3)),
      tuple[3],
      tuple[4],
      tuple[5],
      utils.bigNumberify(tuple[6]))
  }

  static decode(bytes: string): SplitTransaction {
    return SplitTransaction.fromTuple(RLP.decode(bytes))
  }

  getOutputWith(index: number): TransactionOutput {
    if(index == 0) {
      return new TransactionOutput(
        new Segment(this.segment.start, this.offset),
        this.to1
      )
    }else {
      return new TransactionOutput(
        new Segment(this.offset, this.segment.end),
        this.to2
      )
    }
  }

}

export class MergeTransaction extends BaseTransaction {
  from: Address
  segment1: Segment
  segment2: Segment
  blkNum1: Uint256
  blkNum2: Uint256
  to: Address

  constructor(
    from: Address,
    segment1: Segment,
    segment2: Segment,
    blkNum1: Uint256,
    blkNum2: Uint256,
    to: Address
  ) {
    super([
      from,
      segment1.start,
      segment1.end,
      segment2.start,
      segment2.end,
      blkNum1,
      blkNum2,
      to])
    this.from = from
    this.segment1 = segment1
    this.segment2 = segment2
    this.blkNum1 = blkNum1
    this.blkNum2 = blkNum2
    this.to = to
  }

  static fromTuple(tuple: RLPItem[]): MergeTransaction {
    return new MergeTransaction(
      tuple[0],
      Segment.fromTuple(tuple.slice(1, 3)),
      Segment.fromTuple(tuple.slice(3, 5)),
      tuple[5],
      tuple[6],
      tuple[7])
  }

  static decode(bytes: string): MergeTransaction {
    return MergeTransaction.fromTuple(RLP.decode(bytes))
  }

  getOutput(): TransactionOutput {
    return new TransactionOutput(
      new Segment(this.segment1.start, this.segment2.end),
      this.to
    )
  }

}

export class SwapTransaction extends BaseTransaction {

  constructor(
    from1: Address,
    segment1: Segment,
    blkNum1: Uint256,
    from2: Address,
    segment2: Segment,
    blkNum2: Uint256
  ) {
    super([
      from1,
      segment1.start,
      segment1.end,
      blkNum1,
      from2,
      segment2.start,
      segment2.end,
      blkNum2])
  }

  static fromTuple(tuple: RLPItem[]): SwapTransaction {
    return new SwapTransaction(
      tuple[0],
      Segment.fromTuple(tuple.slice(1, 3)),
      tuple[3],
      tuple[4],
      Segment.fromTuple(tuple.slice(5, 7)),
      tuple[7])
  }

}

export class Multisig2Transaction extends BaseTransaction {

  constructor(
    lockstate: LockState,
    nextstate: LockState,
    from1: Address,
    segment1: Segment,
    blkNum1: Uint256,
    from2: Address,
    segment2: Segment,
    blkNum2: Uint256
  ) {
    super([
      lockstate,
      nextstate,
      from1,
      segment1.start,
      segment1.end,
      blkNum1,
      from2,
      segment2.start,
      segment2.end,
      blkNum2])
  }

  static fromTuple(tuple: RLPItem[]): Multisig2Transaction {
    return new Multisig2Transaction(
      tuple[0],
      tuple[1],
      tuple[2],
      Segment.fromTuple(tuple.slice(3, 5)),
      tuple[5],
      tuple[6],
      Segment.fromTuple(tuple.slice(7, 9)),
      tuple[9])
  }

}

/**
 * SignedTransaction is the transaction and its signatures
 */
export class SignedTransaction {
  tx: BaseTransaction
  signatures: Signature[]

  constructor(
    tx: BaseTransaction,
    signatures: Signature[]
  ) {
    this.tx = tx
    this.signatures = signatures
  }

}

/**
 * SignedTransactionWithProof is the transaction and its signatures and proof
 */
export class SignedTransactionWithProof extends SignedTransaction {
  proofs: MerkleProof[]

  constructor(
    tx: BaseTransaction,
    signatures: Signature[],
    proofs: MerkleProof[]
  ) {
    super(tx, signatures)
    this.proofs = proofs
  }

}
