import { utils } from "ethers"
import {
  Segment
} from './segment'
import {
  RLPItem
} from './helpers/ethers'
import RLP = utils.RLP

export type LockState = string
export type Address = string

/**
 * TransactionOutput class is input or output of transaction.
 */
export class TransactionOutput {
  lockState: LockState
  owners: Address[]
  segments: Segment[]


  constructor(
    lockState: LockState,
    owners: Address[],
    segments: Segment[]
  ) {
    this.lockState = lockState
    this.owners = owners
    this.segments = segments
  }

  toTuple(): RLPItem[] {
    return [
      this.lockState,
      this.owners,
      this.segments.map(segment => segment.toTuple())
    ]
  }

  static fromTuple(tuple: RLPItem[]): TransactionOutput {
    return new TransactionOutput(
      tuple[0],
      tuple[1],
      tuple[2].map((t: RLPItem[]) => Segment.fromTuple(t))
    )
  }

  encode(): string {
    return RLP.encode(this.toTuple())
  }

  static decode(bytes: string): TransactionOutput {
    return TransactionOutput.fromTuple(RLP.decode(bytes))
  }

  static own(owner: Address, segment: Segment): TransactionOutput {
    return new TransactionOutput('0x0', [owner], [segment])
  }

}
