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

  private getSwapTx(
    owner: Address,
    blkNum: BigNumber,
    segment: Segment
  ) {
    if(segment.getAmount().gte(this.segment.getAmount())) {
      return new SwapTransaction(
        owner,
        segment,
        blkNum,
        this.getOwner(),
        this.segment,
        this.getBlkNum(),
        segment.start.add(this.segment.getAmount()),
        this.segment.end
      )
    } else {
      throw new Error('segment amount should be bigger than requested amount')
      /*
      return new SwapTransaction(
        owner,
        segment,
        blkNum,
        this.getOwner(),
        this.segment,
        this.getBlkNum(),
        segment.end,
        this.segment.start.add(segment.getAmount()),
      )
      */
    }
  }

}
