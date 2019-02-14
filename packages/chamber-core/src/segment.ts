import {
  utils
} from "ethers"
import {
  RLPItem
} from './helpers/types'
import {
  TOTAL_AMOUNT
} from './helpers/constants'
import BigNumber = utils.BigNumber
import RLP = utils.RLP

/**
 * Segment class is one segment of deposited value on Plasma
 */
export class Segment {
  start: BigNumber;
  end: BigNumber;

  /**
   * Segment
   * @param start 
   * @param end 
   */
  constructor(
    start: BigNumber,
    end: BigNumber
  ) {
    this.start = start;
    this.end = end;
  }

  getAmount() {
    return this.end.sub(this.start)
  }

  toBigNumber(): BigNumber {
    return this.start.mul(TOTAL_AMOUNT).add(this.end)
  }

  static fromBigNumber(bn: BigNumber): Segment {
    const start = bn.div(TOTAL_AMOUNT)
    const end = bn.sub(start.mul(TOTAL_AMOUNT))
    return new Segment(start, end)
  }

  toTuple(): BigNumber[] {
    return [
      this.start,
      this.end
    ]
  }

  static fromTuple(tuple: RLPItem[]): Segment {
    return new Segment(
      utils.bigNumberify(tuple[0]),
      utils.bigNumberify(tuple[1])
    )
  }

  encode(): string {
    return RLP.encode([
      this.start,
      this.end
    ])
  }

  static decode(bytes: string): Segment {
    return Segment.fromTuple(RLP.decode(bytes))
  }

  serialize(): string[] {
    return [
      this.start.toString(),
      this.end.toString()
    ]
  }

  static deserialize(data: string[]): Segment {
    return new Segment(
      utils.bigNumberify(data[0]),
      utils.bigNumberify(data[1])
    )
  }

}
