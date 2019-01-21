import {
  SignedTransaction
} from './tx'
import {
  SumMerkleTreeNode,
  SumMerkleTree
} from './merkle'
import {
  Segment
} from './segment'
import { HashZero } from 'ethers/constants';
import { BigNumber } from 'ethers/utils';

class SegmentNode {
  segment: Segment
  tx: string

  constructor(
    segment: Segment,
    tx: string
  ) {
    this.segment = segment
    this.tx = tx
  }
}

export class Block {
  txs: SignedTransaction[]

  constructor(
  ) {
    this.txs = []
  }

  appendTx(tx: SignedTransaction) {
    this.txs.push(tx)
  }

  /**
   * @description construct merkle tree
   *     by segments of the transaction output
   */
  createTree() {
    let segments: SegmentNode[] = []
    this.txs.forEach(tx => {
      tx.getSegments().forEach(s => {
        segments.push(new SegmentNode(s, tx.hash()))
      })
    })
    segments.sort((a, b) => {
      if(a.segment.start.gt(b.segment.start)) return 1
      else if(a.segment.start.lt(b.segment.start)) return -1
      else return 0
    })
    const nodes = segments.reduce((acc: SegmentNode[], segmentNode: SegmentNode) => {
      let prevEnd = new BigNumber(0)
      if(acc.length > 0)
        prevEnd = acc[acc.length - 1].segment.end
      if(segmentNode.segment.start.gt(prevEnd)) {
        return acc.concat([new SegmentNode(new Segment(prevEnd, segmentNode.segment.start), HashZero), segmentNode])
      }else if(segmentNode.segment.start.eq(prevEnd)) {
        return acc.concat([segmentNode])
      }else{
        throw new Error('segment duplecated')
      }
    }, [])
    const leaves = nodes.map(n => new SumMerkleTreeNode(
      n.tx,
      n.segment.getAmount()
    ))
    return new SumMerkleTree(leaves)
  }

}
