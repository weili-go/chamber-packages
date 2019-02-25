import { Segment } from '../segment';
import { SwapTransaction, TransactionOutput } from '../tx';
import { Address } from '../helpers/types';
import * as ethers from 'ethers'
import BigNumber = ethers.utils.BigNumber
import { SignedTransaction } from '../SignedTransaction';

export class SwapRequest {
  owner: Address
  blkNum: BigNumber
  segment: Segment
  neightborBlkNum: BigNumber
  neighbor: Segment
  target?: TransactionOutput

  constructor(
    owner: Address,
    blkNum: BigNumber,
    segment: Segment,
    neightborBlkNum: BigNumber,
    neighbor: Segment
  ) {
    this.owner = owner
    this.blkNum = blkNum
    this.segment = segment
    this.neighbor = neighbor
    this.neightborBlkNum = neightborBlkNum
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

  getNeighborBlkNum() {
    return this.neightborBlkNum
  }

  serialize() {
    return {
      owner: this.owner,
      blkNum: this.blkNum.toString(),
      segment: this.segment.serialize(),
      neightborBlkNum: this.neightborBlkNum.toString(),
      neighbor: this.neighbor.serialize()
    }
  }

  static deserialize(data: any) {
    return new SwapRequest(
      data.owner,
      ethers.utils.bigNumberify(data.blkNum),
      Segment.deserialize(data.segment),
      ethers.utils.bigNumberify(data.neightborBlkNum),
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

  setTarget(target: TransactionOutput) {
    this.target = target
  }

  getSignedSwapTx() {
    if(this.target) {
      const tx = this.getSwapTx(this.target.getOwners()[0], this.target.getBlkNum(), this.target.getSegment(0))
      if(tx)
        return new SignedTransaction(tx)
    } else {
      throw new Error('target not setted')
    }
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
        new Segment(segment.getTokenId(), segment.start, segment.start.add(this.segment.getAmount())),
        blkNum,
        this.getOwner(),
        this.segment,
        this.getBlkNum())
    } else if(this.neighbor.getAmount().gte(segment.getAmount())) {
      // case: segment < this.segment
      // swap this.neighbor:left segment
      return new SwapTransaction(
        owner,
        segment,
        blkNum,
        this.getOwner(),
        new Segment(this.neighbor.getTokenId(), this.neighbor.start, this.neighbor.start.add(segment.getAmount())),
        this.getBlkNum())
    } else {
      return null
    }
  }

}
