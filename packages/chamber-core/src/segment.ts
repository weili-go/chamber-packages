import {
  utils
} from "ethers"
import {
  RLPItem
} from './helpers/types'
import {
  MASK8BYTES,
  TOTAL_AMOUNT
} from './helpers/constants'
import BigNumber = utils.BigNumber
import RLP = utils.RLP

/**
 * Segment class is one segment of deposited value on Plasma
 */
export class Segment {
  tokenId: BigNumber
  start: BigNumber
  end: BigNumber


  /**
   * Segment
   * @param tokenId
   * @param start 
   * @param end 
   */
  constructor(
    tokenId: BigNumber,
    start: BigNumber,
    end: BigNumber
  ) {
    this.tokenId = tokenId
    this.start = start
    this.end = end
  }

  getTokenId() {
    return this.tokenId
  }

  getAmount() {
    return this.end.sub(this.start)
  }

  static ETH(
    start: BigNumber,
    end: BigNumber
  ) {
    return new Segment(
      utils.bigNumberify(0),
      start,
      end
    )
  }

  getGlobalStart() {
    return this.start.add(this.tokenId.mul(TOTAL_AMOUNT))
  }

  getGlobalEnd() {
    return this.end.add(this.tokenId.mul(TOTAL_AMOUNT))
  }

  static fromGlobal(
    start: BigNumber,
    end: BigNumber
  ) {
    const tokenId = start.div(TOTAL_AMOUNT)
    return new Segment(
      tokenId,
      start.sub(tokenId.mul(TOTAL_AMOUNT)),
      end.sub(tokenId.mul(TOTAL_AMOUNT))
    )
  }

  toBigNumber(): BigNumber {
    return this.tokenId
            .mul(MASK8BYTES)
            .mul(MASK8BYTES)
            .add(this.start.mul(MASK8BYTES).add(this.end))
  }

  static fromBigNumber(bn: BigNumber): Segment {
    const tokenId = bn.div(MASK8BYTES).div(MASK8BYTES)
    const start = bn.sub(tokenId.mul(MASK8BYTES).mul(MASK8BYTES)).div(MASK8BYTES)
    const end = bn.sub(tokenId.mul(MASK8BYTES).mul(MASK8BYTES)).sub(start.mul(MASK8BYTES))
    return new Segment(tokenId, start, end)
  }

  toTuple(): BigNumber[] {
    return [
      this.tokenId,
      this.start,
      this.end
    ]
  }

  static fromTuple(tuple: RLPItem[]): Segment {
    return new Segment(
      utils.bigNumberify(tuple[0]),
      utils.bigNumberify(tuple[1]),
      utils.bigNumberify(tuple[2])
    )
  }

  encode(): string {
    return RLP.encode(this.toTuple())
  }

  static decode(bytes: string): Segment {
    return Segment.fromTuple(RLP.decode(bytes))
  }

  serialize(): string[] {
    return [
      this.tokenId.toString(),
      this.start.toString(),
      this.end.toString()
    ]
  }

  static deserialize(data: string[]): Segment {
    return new Segment(
      utils.bigNumberify(data[0]),
      utils.bigNumberify(data[1]),
      utils.bigNumberify(data[2])
    )
  }

  isContain(segment: Segment) {
    return this.getTokenId().eq(segment.getTokenId())
    && this.start.lte(segment.start)
    && this.end.gte(segment.end)
  }

  sub(segment: Segment) {
    const s1 = new Segment(
      this.tokenId,
      this.start,
      segment.start
    )
    const s2 = new Segment(
      this.tokenId,
      segment.end,
      this.end
    )
    return [s1, s2].filter(s => !s.getAmount().eq(0))
  }

}
