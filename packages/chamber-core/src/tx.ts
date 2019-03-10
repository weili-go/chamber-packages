import { utils } from "ethers"
import {
  Segment
} from './segment'
import {
  Address,
  LockState,
  RLPTx,
  RLPItem,
  Hash,
} from './helpers/types';
import * as constants from './helpers/constants'

import BigNumber = utils.BigNumber

export class DecoderUtility {
  static decode(bytes: string) {
    const len = Math.floor(utils.hexDataLength(bytes) / 32)
    let arr = []
    for(let i = 0;i < len;i++) {
      arr.push(utils.hexDataSlice(bytes, i * 32, i * 32 + 32))
    }
    return arr
  }

  static getAddress(addressString: string) {
    return utils.getAddress(utils.hexDataSlice(addressString, 12, 32))
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

  /**
   * @description verify function verify transaction's segment, owner and signatures.
   * @param signatures 
   */
  abstract verify(signatures: string[]): boolean

  abstract normalizeSigs(signatures: string[], hash?: string): string[]

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
    if(label === 11) {
      return SplitTransaction.fromTuple(body).withMaxBlkNum(maxBlkNum)
    }else if(label === 12) {
      return MergeTransaction.fromTuple(body).withMaxBlkNum(maxBlkNum)
    }else if(label === 1) {
      return DepositTransaction.fromTuple(body).withMaxBlkNum(maxBlkNum)
    }else if(label === 21) {
      return SwapTransaction.fromTuple(body).withMaxBlkNum(maxBlkNum)
    }else{
      throw new Error('unknown label')
    }
  }
}

export class TransactionOutputDeserializer {

  static deserialize(data: any[]): TransactionOutput {
    if(data[0] == 'own') {
      return OwnState.deserialize(data)
    } else {
      throw new Error('unknown state')
    }
  }
}

export interface TransactionOutput {
  getLabel(): Hash
  withBlkNum(blkNum: BigNumber): TransactionOutput
  getOwners(): Address[]
  getBlkNum(): BigNumber
  getSegment(index: number): Segment
  hash(): Hash
  getBytes(): string
  serialize(): any
  /**
   * @description checkSpend function verify that the transaction spend UTXO correctly.
   * @param txo 
   */
  checkSpend(txo: TransactionOutput): boolean
  subSpend(txo: TransactionOutput): TransactionOutput[]
  toObject(): any
}

let OwnStateAddress = constants.OwnStateAddress
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

  static setAddress(_OwnStateAddress: Address) {
    OwnStateAddress = _OwnStateAddress
  }

  getLabel(): Hash {
    return utils.hexZeroPad(OwnStateAddress, 32)
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

  serialize() {
    return [
      'own',
      this.getOwners()[0],
      this.getSegment(0).serialize(),
      this.getBlkNum().toString()
    ]
  }

  static deserialize(data: any[]) {
    return new OwnState(
      Segment.deserialize(data[2]),
      data[1]
    ).withBlkNum(utils.bigNumberify(data[3]))
  }

  getBytes() {
    if(this.blkNum) {
      return this.joinHex([
        utils.hexZeroPad(utils.hexlify(this.getLabel()), 32),
        utils.hexZeroPad(utils.hexlify(this.owner), 32),
        utils.hexZeroPad(utils.hexlify(this.segment.toBigNumber()), 32),
        utils.hexZeroPad(utils.hexlify(this.blkNum), 32)
      ])
    } else {
      throw new Error('blkNum should not be null to get hash')
    }
  }

  hash(): Hash {
    return utils.keccak256(this.getBytes())
  }

  /**
   * @description verify txo spend this instance correctly
   */
  checkSpend(txo: TransactionOutput): boolean {
    if(txo.getLabel() == this.getLabel()
      && txo.getBlkNum().eq(this.getBlkNum())
      && txo.getOwners()[0] == this.getOwners()[0]
      && this.getSegment(0).isContain(txo.getSegment(0))) {
      return true
    } else {
      return false
    }
  }

  subSpend(txo: TransactionOutput): TransactionOutput[] {
    const newSegments = this.getSegment(0).sub(txo.getSegment(0))
    return newSegments.map(s => {
      return new OwnState(s, this.getOwners()[0]).withBlkNum(this.getBlkNum())
    })
  }

  private joinHex(a: string[]) {
    return utils.hexlify(utils.concat(a.map(s => utils.arrayify(s))))
  }

  toObject() {
    return {
      start: this.getSegment(0).start.toString(),
      end: this.getSegment(0).end.toString(),
      owner: this.getOwners(),
      blkNum: this.getBlkNum().toString()
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
    super(1, [depositor, segment.toBigNumber()])
    this.depositor = depositor
    this.segment = segment
  }

  static fromTuple(tuple: RLPItem[]): DepositTransaction {
    return new DepositTransaction(
      DecoderUtility.getAddress(tuple[0]),
      Segment.fromBigNumber(utils.bigNumberify(tuple[1])))
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

  normalizeSigs(signatures: string[], hash?: string): string[] {
    return signatures
  }

  requireConfsig(): boolean {
    return false
  }

}

export class SplitTransaction extends BaseTransaction {
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
    super(11, [from, segment.toBigNumber(), blkNum, to])
    this.from = from
    this.segment = segment
    this.blkNum = blkNum
    this.to = to
  }

  static Transfer(
    from: Address,
    segment: Segment,
    blkNum: BigNumber,
    to: Address
  ) {
    return new SplitTransaction(from, segment, blkNum, to)
  }

  static fromTuple(tuple: RLPItem[]): SplitTransaction {
    return new SplitTransaction(
      DecoderUtility.getAddress(tuple[0]),
      Segment.fromBigNumber(utils.bigNumberify(tuple[1])),
      utils.bigNumberify(tuple[2]),
      DecoderUtility.getAddress(tuple[3]))
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
    return this.getOutputs()[index]
  }
  
  getOutputs() {
    return [
      new OwnState(
        this.segment,
        this.to
      )]
  }

  getSegments(): Segment[] {
    return [this.segment]
  }

  /**
   * @description verify transfer transaction
   *     see also https://github.com/cryptoeconomicslab/chamber-packages/blob/master/packages/chamber-contracts/contracts/verifier/StandardVerifier.vy#L92
   * @param signatures 
   */
  verify(signatures: string[]): boolean {
    return utils.recoverAddress(
      this.hash(), signatures[0]) == this.from
  }

  normalizeSigs(signatures: string[], hash?: string): string[] {
    return signatures
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
    super(12, 
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
      DecoderUtility.getAddress(tuple[0]),
      new Segment(segment.tokenId, segment.start, offset),
      new Segment(segment.tokenId, offset, segment.end),
      DecoderUtility.getAddress(tuple[3]),
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
  
  /**
   * @description verify transaction
   *     see also https://github.com/cryptoeconomicslab/chamber-packages/blob/master/packages/chamber-contracts/contracts/verifier/StandardVerifier.vy#L154
   * @param signatures 
   */
  verify(signatures: string[]): boolean {
    return utils.recoverAddress(
      this.hash(), signatures[0]) == this.from
  }

  normalizeSigs(signatures: string[], hash?: string): string[] {
    return signatures
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

  constructor(
    from1: Address,
    segment1: Segment,
    blkNum1: BigNumber,
    from2: Address,
    segment2: Segment,
    blkNum2: BigNumber
  ) {
    super(21,
      [from1,
        segment1.toBigNumber(),
        blkNum1,
        from2,
        segment2.toBigNumber(),
        blkNum2])
    this.from1 = from1
    this.from2 = from2
    this.segment1 = segment1
    this.segment2 = segment2
    this.blkNum1 = blkNum1
    this.blkNum2 = blkNum2
    if(this.segment1.getGlobalStart().gte(this.segment2.getGlobalEnd())) {
      this.from2 = from1
      this.from1 = from2
      this.blkNum2 = blkNum1
      this.blkNum1 = blkNum2
      this.segment2 = segment1
      this.segment1 = segment2
    }
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
      blkNum2
    )
  }

  static fromTuple(tuple: RLPItem[]): SwapTransaction {
    return new SwapTransaction(
      DecoderUtility.getAddress(tuple[0]),
      Segment.fromBigNumber(utils.bigNumberify(tuple[1])),
      utils.bigNumberify(tuple[2]),
      DecoderUtility.getAddress(tuple[3]),
      Segment.fromBigNumber(utils.bigNumberify(tuple[4])),
      utils.bigNumberify(tuple[5]))
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

  getInputByOwner(owner: Address): TransactionOutput | null {
    const inputs = this.getInputs()
    if(inputs[0].getOwners().indexOf(owner) >= 0) {
      return inputs[0]
    } else if(inputs[1].getOwners().indexOf(owner) >= 0) {
      return inputs[1]
    } else {
      return null
    }
  }

  getOutput(index: number): TransactionOutput {
    return this.getOutputs()[index]
  }

  getOutputs() {
    return [
      new OwnState(
        this.segment1,
        this.from2),
      new OwnState(
        this.segment2,
        this.from1)]
  }
    
  getSegments(): Segment[] {
    return [this.segment1, this.segment2]
  }

  /**
   * @description verify swap transaction
   *     see also https://github.com/cryptoeconomicslab/chamber-packages/blob/master/packages/chamber-contracts/contracts/verifier/MultisigVerifier.vy#L86
   * @param signatures 
   */
  verify(signatures: string[]): boolean {
    return utils.recoverAddress(
      this.hash(), signatures[0]) == this.from1
      && utils.recoverAddress(
        this.hash(), signatures[1]) == this.from2
  }

  normalizeSigs(signatures: string[], hash?: string): string[] {
    if(signatures.length == 2) {
      if(utils.recoverAddress(
        hash?hash:this.hash(), signatures[0]) == this.from2) {
          return signatures.reverse()
        }
    }
    return signatures
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
