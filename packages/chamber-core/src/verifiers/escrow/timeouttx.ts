import { utils } from "ethers"
import BigNumber = utils.BigNumber
import {
  BaseTransaction,
  DecoderUtility,
  OwnState,
  TransactionOutput
} from '../../internal'
import {
  Segment
} from '../../segment'
import {
  Address,
  RLPItem,
} from '../../helpers/types'
import { EscrowLockState } from './lockstate'

export class EscrowTimeoutTransaction extends BaseTransaction {
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
    super(23, [from, segment.toBigNumber(), blkNum, ttp, to, timeout])
    this.from = from
    this.segment = segment
    this.blkNum = blkNum
    this.ttp = ttp
    this.to = to
    this.timeout = timeout
  }

  static fromTuple(tuple: RLPItem[]): EscrowTimeoutTransaction {
    return new EscrowTimeoutTransaction(
      utils.getAddress(tuple[0]),
      Segment.fromBigNumber(utils.bigNumberify(tuple[1])),
      utils.bigNumberify(tuple[2]),
      utils.getAddress(tuple[3]),
      utils.getAddress(tuple[4]),
      utils.bigNumberify(tuple[5]))
  }

  static decode(bytes: string): EscrowTimeoutTransaction {
    return EscrowTimeoutTransaction.fromTuple(DecoderUtility.decode(bytes))
  }

  getInput(): TransactionOutput {
    return new EscrowLockState(
      this.segment,
      this.from,
      this.ttp,
      this.to,
      this.timeout
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
        this.from
      )]
  }

  getSegments(): Segment[] {
    return [this.segment]
  }

  verify(signatures: string[]): boolean {
    return this.timeout.lt(new Date().getTime())
      &&
      (
        utils.recoverAddress(this.hash(), signatures[0]) == this.from
        ||
        utils.recoverAddress(this.hash(), signatures[0]) == this.ttp
      )
  }

  normalizeSigs(signatures: string[], hash?: string): string[] {
    return signatures
  }

  requireConfsig(): boolean {
    return false
  }

}