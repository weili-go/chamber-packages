import { Segment } from '../segment';
import { SwapTransaction } from '../tx';
import { Address } from '../helpers/types';
import * as ethers from 'ethers'
import BigNumber = ethers.utils.BigNumber
import { SignedTransaction } from '../SignedTransaction';

export class SwapRequest {
  owner: Address
  blkNum: BigNumber
  segment: Segment
  neighbor: Segment

  constructor(
    owner: Address,
    blkNum: BigNumber,
    segment: Segment,
    neighbor: Segment
  ) {
    this.owner = owner
    this.blkNum = blkNum
    this.segment = segment
    this.neighbor = neighbor
  }

  getOwner() {
    return this.owner
  }

  getBlkNum() {
    return this.blkNum
  }

  getNeighbor() {
    return this.neighbor
  }

  serialize() {
    return {
      owner: this.owner,
      blkNum: this.blkNum.toString(),
      segment: this.segment.serialize(),
      neighbor: this.neighbor.serialize()
    }
  }

  static deserialize(data: any) {
    return new SwapRequest(
      data.owner,
      ethers.utils.bigNumberify(data.blkNum),
      Segment.deserialize(data.segment),
      Segment.deserialize(data.neighbor))
  }

  /**
   * 
   * @param segment 
   * segment - neightbor
   * or neightbor - segment
   */
  check(
    segment: Segment
  ) {
    return this.neighbor.end.eq(segment.start) || this.neighbor.start.eq(segment.end)
  }

  getSignedSwapTx(
    owner: Address,
    blkNum: BigNumber,
    segment: Segment
  ) {
    const tx = this.getSwapTx(owner, blkNum, segment)
    return new SignedTransaction(tx)
  }

  /**
   * 
   * @param owner 
   * @param blkNum 
   * @param segment 
   * neighbor - segment - this.segment
   * case: segment >= this.segment
   *   segment:offset and this.segment
   * case: segment < this.segment
   * neighbor - segment - this.segment
   *   segment and this.segment:offset
   */
  private getSwapTx(
    owner: Address,
    blkNum: BigNumber,
    segment: Segment
  ) {
    if(segment.getAmount().gte(this.segment.getAmount())) {
      // case: segment >= this.segment
      // swap segment:left and this.segment
      return new SwapTransaction(
        owner,
        segment,
        blkNum,
        this.getOwner(),
        this.segment,
        this.getBlkNum(),
        this.segment.getAmount(),
        this.segment.getAmount()
      )
    } else {
      // case: segment < this.segment
      // swap segment and left:this.segment
      return new SwapTransaction(
        owner,
        segment,
        blkNum,
        this.getOwner(),
        this.segment,
        this.getBlkNum(),
        segment.getAmount(),
        segment.getAmount()
      )
    }
  }

}
