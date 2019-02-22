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
  Hash,
} from './helpers/types';
import BigNumber = utils.BigNumber

class DecoderUtility {
  static decode(bytes: string) {
    const len = Math.floor(utils.hexDataLength(bytes) / 32)
    let arr = []
    for(let i = 0;i < len;i++) {
      arr.push(utils.hexStripZeros(utils.hexDataSlice(bytes, i * 32, i * 32 + 32)))
    }
    return arr
  }
}
/**
 * BaseTransaction is raw transaction data structure
 * @title BaseTransaction
 * @descriotion abstract class of Transaction
 */
export abstract class BaseTransaction {

  label: BigNumber
  maxBlock: BigNumber
  items: RLPTx

  /**
   * BaseTransaction
   * @param label is transaction type
   * @param items is transaction body
   */
  constructor(label: number, items: RLPTx) {
    this.label = utils.bigNumberify(label)
    this.maxBlock = utils.bigNumberify(0)
    this.items = items
  }

  withMaxBlkNum(maxBlock: number) {
    this.maxBlock = utils.bigNumberify(maxBlock)
    return this
  }

  encode(): string {
    const label = utils.padZeros(utils.arrayify(this.label), 8)
    const maxBlock = utils.padZeros(utils.arrayify(this.maxBlock), 8)
    const arr = this.items.map((i: RLPItem) => {
      return utils.padZeros(utils.arrayify(i), 32)
    })
    return utils.hexlify(utils.concat([label, maxBlock].concat(arr)))
  }

  hash(): string {
    return utils.keccak256(this.encode())
  }

  abstract getInput(index: number): TransactionOutput

  abstract getInputs(): TransactionOutput[]

  abstract getOutput(index: number): TransactionOutput

  abstract getOutputs(): TransactionOutput[]

  abstract getSegments(): Segment[]

  abstract verify(signatures: string[]): boolean

  abstract requireConfsig(): boolean

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
    const label = utils.bigNumberify(utils.hexDataSlice(bytes, 0, 8)).toNumber()
    const maxBlkNum = utils.bigNumberify(utils.hexDataSlice(bytes, 8, 16)).toNumber()
    const body = DecoderUtility.decode(utils.hexDataSlice(bytes, 16, 496))
    if(label === 2) {
      return SplitTransaction.fromTuple(body).withMaxBlkNum(maxBlkNum)
    }else if(label === 3) {
      return MergeTransaction.fromTuple(body).withMaxBlkNum(maxBlkNum)
    }else if(label === 4) {
      return DepositTransaction.fromTuple(body).withMaxBlkNum(maxBlkNum)
    }else if(label === 5) {
      return SwapTransaction.fromTuple(body).withMaxBlkNum(maxBlkNum)
    }else{
      throw new Error('unknown label')
    }
  }
}

export interface TransactionOutput {
  withBlkNum(blkNum: BigNumber): TransactionOutput
  getOwners(): Address[]
  getBlkNum(): BigNumber
  getSegment(index: number): Segment
  hash(): Hash
}

export class OwnState implements TransactionOutput {
  segment: Segment
  owner: Address
  blkNum: BigNumber | null

  constructor(
    segment: Segment,
    owner: Address
  ) {
    this.segment = segment
    this.owner = owner
    this.blkNum = null
  }

  withBlkNum(blkNum: BigNumber) {
    this.setBlkNum(blkNum)
    return this
  }

  setBlkNum(blkNum: BigNumber) {
    this.blkNum = blkNum
  }

  getBlkNum() {
    if(this.blkNum) {
      return this.blkNum
    } else {
      throw new Error('blkNum should not be null to getBlkNum')
    }
  }

  getOwners() {
    return [this.owner]
  }

  getSegment(index: number) {
    return this.segment
  }

  hash(): Hash {
    if(this.blkNum) {
      return utils.keccak256(join([
        utils.hexlify(utils.toUtf8Bytes('own')),
        utils.hexZeroPad(utils.hexlify(this.owner), 32),
        utils.hexZeroPad(utils.hexlify(this.segment.tokenId), 32),
        utils.hexZeroPad(utils.hexlify(this.segment.start), 32),
        utils.hexZeroPad(utils.hexlify(this.segment.end), 32),
        utils.hexZeroPad(utils.hexlify(this.blkNum), 32)
      ]))
    }else{
      throw new Error('blkNum should not be null to get hash')
    }
    function join(a: string[]) {
      return utils.hexlify(utils.concat(a.map(s => utils.arrayify(s))))
    }
  }

}

export class DepositTransaction extends BaseTransaction {
  depositor: Address
  segment: Segment

  constructor(
    depositor: Address,
    segment: Segment
  ) {
    super(4, [depositor, segment.getTokenId(), segment.toBigNumber()])
    this.depositor = depositor
    this.segment = segment
  }

  static fromTuple(tuple: RLPItem[]): DepositTransaction {
    return new DepositTransaction(
      utils.getAddress(tuple[0]),
      Segment.fromBigNumber(utils.bigNumberify(tuple[2])))
  }

  static decode(bytes: string): DepositTransaction {
    return DepositTransaction.fromTuple(DecoderUtility.decode(bytes))
  }

  getInput(): TransactionOutput {
    throw new Error('no input')
  }

  getInputs(): TransactionOutput[] {
    return []
  }

  getOutput(): TransactionOutput {
    return new OwnState(
      this.segment,
      this.depositor
    )
  }

  getOutputs() {
    return [this.getOutput()]
  }

  getSegments(): Segment[] {
    return [this.segment]
  }

  verify(signatures: string[]): boolean {
    return true
  }

  requireConfsig(): boolean {
    return false
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
    super(2, [from, segment.toBigNumber(), blkNum, to1, to2, offset])
    this.from = from
    this.segment = segment
    this.blkNum = blkNum
    this.to1 = to1
    this.to2 = to2
    this.offset = offset
  }

  static Transfer(
    from: Address,
    segment: Segment,
    blkNum: BigNumber,
    to: Address
  ) {
    return new SplitTransaction(from, segment, blkNum, to, to, segment.end)
  }

  static fromTuple(tuple: RLPItem[]): SplitTransaction {
    return new SplitTransaction(
      utils.getAddress(tuple[0]),
      Segment.fromBigNumber(utils.bigNumberify(tuple[1])),
      utils.bigNumberify(tuple[2]),
      utils.getAddress(tuple[3]),
      utils.getAddress(tuple[4]),
      utils.bigNumberify(tuple[5]))
  }

  static decode(bytes: string): SplitTransaction {
    return SplitTransaction.fromTuple(DecoderUtility.decode(bytes))
  }

  getInput(): TransactionOutput {
    return new OwnState(
      this.segment,
      this.from
    ).withBlkNum(this.blkNum)
  }

  getInputs(): TransactionOutput[] {
    return [this.getInput()]
  }

  getOutput(index: number): TransactionOutput {
    if(index == 0) {
      return new OwnState(
        new Segment(this.segment.tokenId, this.segment.start, this.offset),
        this.to1
      )
    }else {
      return new OwnState(
        new Segment(this.segment.tokenId, this.offset, this.segment.end),
        this.to2
      )
    }
  }

  getOutputs() {
    return [this.getOutput(0), this.getOutput(1)]
  }

  getSegments(): Segment[] {
    return [
      new Segment(this.segment.tokenId, this.segment.start, this.offset),
      new Segment(this.segment.tokenId, this.offset, this.segment.end)
    ]
  }

  verify(signatures: string[]): boolean {
    return utils.recoverAddress(
      this.hash(), signatures[0]) == this.from
  }

  requireConfsig(): boolean {
    return false
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
    to: Address,
    blkNum1: BigNumber,
    blkNum2: BigNumber
  ) {
    super(3, 
      [from,
        new Segment(segment1.tokenId, segment1.start, segment2.end).toBigNumber(),
        segment1.end,
        to,
        blkNum1,
        blkNum2])
    this.from = from
    this.segment1 = segment1
    this.segment2 = segment2
    this.blkNum1 = blkNum1
    this.blkNum2 = blkNum2
    this.to = to
    if(!segment1.end.eq(segment2.start)) throw new Error('not neighborhood')
  }

  static fromTuple(tuple: RLPItem[]): MergeTransaction {
    const segment = Segment.fromBigNumber(utils.bigNumberify(tuple[1]))
    const offset = utils.bigNumberify(tuple[2])
    return new MergeTransaction(
      utils.getAddress(tuple[0]),
      new Segment(segment.tokenId, segment.start, offset),
      new Segment(segment.tokenId, offset, segment.end),
      utils.getAddress(tuple[3]),
      utils.bigNumberify(tuple[4]),
      utils.bigNumberify(tuple[5]))
  }

  static decode(bytes: string): MergeTransaction {
    return MergeTransaction.fromTuple(DecoderUtility.decode(bytes))
  }

  getInput(index: number): TransactionOutput {
    if(index == 0) {
      return new OwnState(
        this.segment1,
        this.from
      ).withBlkNum(this.blkNum1)
    }else{
      return new OwnState(
        this.segment2,
        this.from
      ).withBlkNum(this.blkNum2)
    }
  }

  getInputs(): TransactionOutput[] {
    return [this.getInput(0), this.getInput(1)]
  }

  getOutput(): TransactionOutput {
    return new OwnState(
      new Segment(this.segment1.tokenId, this.segment1.start, this.segment2.end),
      this.to
    )
  }

  getOutputs() {
    return [this.getOutput()]
  }

  getSegments(): Segment[] {
    return [
      new Segment(this.segment1.tokenId, this.segment1.start, this.segment2.end)
    ]
  }
  
  verify(signatures: string[]): boolean {
    return utils.recoverAddress(
      this.hash(), signatures[0]) == this.from
  }

  requireConfsig(): boolean {
    return true
  }

}

export class SwapTransaction extends BaseTransaction {
  from1: Address
  from2: Address
  segment1: Segment
  segment2: Segment
  blkNum1: BigNumber
  blkNum2: BigNumber
  offset1: BigNumber
  offset2: BigNumber

  constructor(
    from1: Address,
    segment1: Segment,
    blkNum1: BigNumber,
    from2: Address,
    segment2: Segment,
    blkNum2: BigNumber,
    offset1: BigNumber,
    offset2: BigNumber
  ) {
    super(5,
      [from1,
        segment1.toBigNumber(),
        blkNum1,
        from2,
        segment2.toBigNumber(),
        blkNum2,
        offset1,
        offset2])
    this.from1 = from1
    this.from2 = from2
    this.segment1 = segment1
    this.segment2 = segment2
    this.blkNum1 = blkNum1
    this.blkNum2 = blkNum2
    this.offset1 = offset1
    this.offset2 = offset2
  }

  static SimpleSwap(
    from1: Address,
    segment1: Segment,
    blkNum1: BigNumber,
    from2: Address,
    segment2: Segment,
    blkNum2: BigNumber
  ) {
    return new SwapTransaction(
      from1,
      segment1,
      blkNum1,
      from2,
      segment2,
      blkNum2,
      segment1.end,
      segment2.end
    )
  }

  static fromTuple(tuple: RLPItem[]): SwapTransaction {
    return new SwapTransaction(
      utils.getAddress(tuple[0]),
      Segment.fromBigNumber(utils.bigNumberify(tuple[1])),
      utils.bigNumberify(tuple[2]),
      utils.getAddress(tuple[3]),
      Segment.fromBigNumber(utils.bigNumberify(tuple[4])),
      utils.bigNumberify(tuple[5]),
      utils.bigNumberify(tuple[6]),
      utils.bigNumberify(tuple[7]))
  }

  static decode(bytes: string): SwapTransaction {
    return SwapTransaction.fromTuple(DecoderUtility.decode(bytes))
  }

  getInput(index: number): TransactionOutput {
    if(index == 0) {
      return new OwnState(
        this.segment1,
        this.from1
      ).withBlkNum(this.blkNum1)
    }else{
      return new OwnState(
        this.segment2,
        this.from2
      ).withBlkNum(this.blkNum2)
    }
  }

  getInputs(): TransactionOutput[] {
    return [this.getInput(0), this.getInput(1)]
  }

  getOutput(index: number): TransactionOutput {
    if(index == 0) {
      return new OwnState(
        new Segment(this.segment1.getTokenId(), this.segment1.start, this.offset1),
        this.from2
      )
    } else if(index == 1) {
      return new OwnState(
        new Segment(this.segment2.getTokenId(), this.segment2.start, this.offset2),
        this.from1
      )
    } else if(index == 2) {
      return new OwnState(
        new Segment(this.segment1.getTokenId(), this.offset1, this.segment1.end),
        this.from1
      )
    } else {
      return new OwnState(
        new Segment(this.segment2.getTokenId(), this.offset2, this.segment2.end),
        this.from2
      )
    }

  }

  getOutputs() {
    return [this.getOutput(0), this.getOutput(1), this.getOutput(2), this.getOutput(3)]
  }
    
  getSegments(): Segment[] {
    return [
      this.segment1,
      this.segment2
    ]
  }

  verify(signatures: string[]): boolean {
    return utils.recoverAddress(
      this.hash(), signatures[0]) == this.from1
      && utils.recoverAddress(
        this.hash(), signatures[1]) == this.from2
  }

  requireConfsig(): boolean {
    return true
  }

}

/*
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
*/
