import {
  utils
} from "ethers"
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

  encode(): string {
    return RLP.encode([
      this.start,
      this.end
    ])
  }

  static decode(bytes: string): Segment {
    const list = RLP.decode(bytes)
    return new Segment(
      utils.bigNumberify(list[0]),
      utils.bigNumberify(list[1])
    )
  }

}
