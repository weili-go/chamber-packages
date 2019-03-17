import { utils } from "ethers"
import BigNumber = utils.BigNumber
import {
  OwnState,
  DecoderUtility,
  TransactionOutput,
  BaseTransaction
} from '../../internal'
import {
  Segment
} from '../../segment'
import {
  Address,
  Hash,
  RLPItem,
} from '../../helpers/types'

export class EscrowLockState extends TransactionOutput {
  segment: Segment
  owner: Address
  ttp: Address
  to: Address
  timeout: BigNumber
  blkNum: BigNumber | null

  constructor(
    segment: Segment,
    owner: Address,
    ttp: Address,
    to: Address,
    timeout: BigNumber
  ) {
    super()
    this.segment = segment
    this.owner = owner
    this.ttp = ttp
    this.to = to
    this.timeout = timeout
    this.blkNum = null
  }

  getLabel(): Hash {
    return utils.keccak256(utils.toUtf8Bytes('escrow'))
  }

  withBlkNum(blkNum: BigNumber):EscrowLockState {
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
      'escrow',
      this.getOwners()[0],
      this.getSegment(0).serialize(),
      this.ttp,
      this.to,
      this.timeout.toString(),
      this.getBlkNum().toString()
    ]
  }

  static deserialize(data: any[]) {
    return new EscrowLockState(
      Segment.deserialize(data[2]),
      data[1],
      data[3],
      data[4],
      utils.bigNumberify(data[5])
    ).withBlkNum(utils.bigNumberify(data[6]))
  }

  getBytes() {
    if(this.blkNum) {
      return this.joinHex([
        this.getLabel(),
        utils.hexZeroPad(utils.hexlify(this.owner), 32),
        utils.hexZeroPad(utils.hexlify(this.segment.tokenId), 32),
        utils.hexZeroPad(utils.hexlify(this.segment.start), 32),
        utils.hexZeroPad(utils.hexlify(this.segment.end), 32),
        utils.hexZeroPad(utils.hexlify(this.blkNum), 32),
        utils.keccak256(this.joinHex([
          utils.hexZeroPad(utils.hexlify(this.ttp), 32),
          utils.hexZeroPad(utils.hexlify(this.to), 32),
          utils.hexZeroPad(utils.hexlify(this.timeout), 32),
        ]))
      ])
    } else {
      throw new Error('blkNum should not be null')
    }
  }

  hash(): Hash {
    return utils.keccak256(this.getBytes())
  }

  isSpent(txo: TransactionOutput): boolean {
    if(txo instanceof OwnState
      && txo.getBlkNum().eq(this.getBlkNum())
      && txo.getOwners()[0] == this.getOwners()[0]
      && this.getSegment(0).isContain(txo.getSegment(0))) {
      return true
    } else {
      return false
    }
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
export class EscrowTransaction extends BaseTransaction {
  from: Address
  segment: Segment
  blkNum: BigNumber
  ttp: Address
  to: Address
  timeout: BigNumber

  constructor(
    from: Address,
    segment: Segment,
    blkNum: BigNumber,
    ttp: Address,
    to: Address,
    timeout: BigNumber
  ) {
    super(31, [from, segment.toBigNumber(), blkNum, ttp, to, timeout])
    this.from = from
    this.segment = segment
    this.blkNum = blkNum
    this.ttp = ttp
    this.to = to
    this.timeout = timeout
  }

  static fromTuple(tuple: RLPItem[]): EscrowTransaction {
    return new EscrowTransaction(
      utils.getAddress(tuple[0]),
      Segment.fromBigNumber(utils.bigNumberify(tuple[1])),
      utils.bigNumberify(tuple[2]),
      utils.getAddress(tuple[3]),
      utils.getAddress(tuple[4]),
      utils.bigNumberify(tuple[5]))
  }

  static decode(bytes: string): EscrowTransaction {
    return EscrowTransaction.fromTuple(DecoderUtility.decode(bytes))
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

  verify(signatures: string[], hash: string): boolean {
    return utils.recoverAddress(
      hash, signatures[0]) == this.from
  }

  normalizeSigs(signatures: string[], hash?: string): string[] {
    return signatures
  }

  requireConfsig(): boolean {
    return false
  }

}
