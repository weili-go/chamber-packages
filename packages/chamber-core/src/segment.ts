import {
  utils
} from "ethers"
import BigNumber = utils.BigNumber
import RLP = utils.RLP

export class Segment {
  start: BigNumber;
  end: BigNumber;

  constructor(
    start: BigNumber,
    end: BigNumber
  ) {
    this.start = start;
    this.end = end;
  }

  static bignumberToBuffer(bn: BigNumber): Buffer {
    return Buffer.from(bn.toHexString(), 'hex');
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
