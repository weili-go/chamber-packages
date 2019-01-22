import { utils } from "ethers"
import {
  Segment
} from './segment'
import RLP = utils.RLP
import {
  Address,
  LockState,
  RLPTx,
  RLPItem,
} from './helpers/types';
import BigNumber = utils.BigNumber

/**
 * BaseTransaction is raw transaction data structure
 * @title BaseTransaction
 * @descriotion abstract class of Transaction
 */
export class BaseTransaction {

  label: number
  items: RLPTx

  /**
   * BaseTransaction
   * @param label is transaction type
   * @param items is transaction body
   */
  constructor(label: number, items: RLPTx) {
    this.label = label
    this.items = items
  }

  toTuple(): RLPItem[] {
    return [utils.bigNumberify(this.label), RLP.encode(this.items)]
  }

  encode(): string {
    return RLP.encode(this.toTuple())
  }

  static fromTuple(tuple: RLPItem[]): BaseTransaction {
    return new BaseTransaction(tuple[0], RLP.decode(tuple[1]))
  }

  static decode(bytes: string): BaseTransaction {
    return BaseTransaction.fromTuple(RLP.decode(bytes))
  }

  hash(): string {
    return utils.keccak256(this.encode())
  }

  getSegments(): Segment[] {
    return []
  }
  
  verify(): boolean {
    return false
  }

  getOutput() {

  }
}

/**
 * @title TransactionDecoder
 * @description The decoder for transaction
 */
export class TransactionDecoder {

  /**
   * decode
   * @param bytes is hex string
   */
  static decode(bytes: string): BaseTransaction {
    const tuple: RLPItem[] = RLP.decode(bytes)
    const label = utils.bigNumberify(tuple[0]).toNumber()
    if(label === 1) {
      return TransferTransaction.decode(tuple[1])
    }else if(label === 2) {
      return SplitTransaction.decode(tuple[1])
    }else if(label === 3) {
      return MergeTransaction.decode(tuple[1])
    }else{
      return TransferTransaction.decode(tuple[1])
    }
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
  blkNum: BigNumber
  to: Address

  constructor(
    from: Address,
    segment: Segment,
    blkNum: BigNumber,
    to: Address
  ) {
    super(1, [from, segment.start, segment.end, blkNum, to])
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

  getSegments(): Segment[] {
    return [this.segment]
  }

}

export class SplitTransaction extends BaseTransaction {
  from: Address
  segment: Segment
  blkNum: BigNumber
  to1: Address
  to2: Address
  offset: BigNumber

  constructor(
    from: Address,
    segment: Segment,
    blkNum: BigNumber,
    to1: Address,
    to2: Address,
    offset: BigNumber,
  ) {
    super(2, [from, segment.start, segment.end, blkNum, to1, to2, offset])
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
  
  getSegments(): Segment[] {
    return [
      new Segment(this.segment.start, this.offset),
      new Segment(this.offset, this.segment.end)
    ]
  }

}

export class MergeTransaction extends BaseTransaction {
  from: Address
  segment1: Segment
  segment2: Segment
  blkNum1: BigNumber
  blkNum2: BigNumber
  to: Address

  constructor(
    from: Address,
    segment1: Segment,
    segment2: Segment,
    blkNum1: BigNumber,
    blkNum2: BigNumber,
    to: Address
  ) {
    super(3, 
      [from,
        segment1.start,
        segment1.end,
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
    if(!segment1.end.eq(segment2.start)) throw new Error('not neighborhood')
  }

  static fromTuple(tuple: RLPItem[]): MergeTransaction {
    return new MergeTransaction(
      tuple[0],
      Segment.fromTuple(tuple.slice(1, 3)),
      Segment.fromTuple(tuple.slice(2, 4)),
      tuple[4],
      tuple[5],
      tuple[6])
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

  getSegments(): Segment[] {
    return [
      new Segment(this.segment1.start, this.segment2.end)
    ]
  }
  
}

export class SwapTransaction extends BaseTransaction {

  constructor(
    from1: Address,
    segment1: Segment,
    blkNum1: BigNumber,
    from2: Address,
    segment2: Segment,
    blkNum2: BigNumber
  ) {
    super(4,
      [from1,
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
    blkNum1: BigNumber,
    from2: Address,
    segment2: Segment,
    blkNum2: BigNumber
  ) {
    super(10,
      [lockstate,
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
