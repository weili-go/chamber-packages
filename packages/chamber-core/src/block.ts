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

/**
 * @title TotalAmount
 * total amount is 2^48
 */
const TotalAmount = new BigNumber(2).pow(48)
/**
 * @title Block
 * @description Plasma Block
 * If we have 40bit for amount, we need 40 depth tree and 2^40 prime numbers.
 * 2^40 is 1.0995116e+12
 * ETH: 1 in plasma is 1 microether
 *     Plasma's capacity is 1098756 ether
 * ETH: 1 in plasma is 1 gwei
 *     Plasma's capacity is 1098 ether
 * 
 * If we have 48bit for amount, we need 48 depth tree and 2^49 prime numbers.
 * 2^48 is 2.8147498e+14(260000000000000)
 * ETH: 1 in plasma is 1 gwei
 *     Plasma's capacity is 260000 ether
 * ETH: 1 in plasma is 10 gwei
 *     Plasma's capacity is 2600000 ether
 *
 * When there are not enough prime numbers, operator don't receive split tx and do merge.
 */
export class Block {
  number: number
  txs: SignedTransaction[]
  tree: SumMerkleTree | null

  constructor(
    number: number
  ) {
    this.number = number
    this.txs = []
    this.tree = null
  }

  appendTx(tx: SignedTransaction) {
    this.txs.push(tx)
  }
  
  getProof(hash: string) {
    if(this.tree === null) {
      this.tree = this.createTree()
    }
    return this.tree.proof(Buffer.from(hash.substr(2), 'hex'))
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
    let nodes = segments.reduce((acc: SegmentNode[], segmentNode: SegmentNode) => {
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
    // add last exclusion segment
    const lastSegment = nodes[nodes.length - 1].segment
    if(lastSegment.end.lt(TotalAmount)) {
      const lastExclusion = new SegmentNode(
        new Segment(lastSegment.end, TotalAmount),
        HashZero)
      nodes.push(lastExclusion)
    }
    const leaves = nodes.map(n => new SumMerkleTreeNode(
      n.tx,
      n.segment.getAmount()
    ))
    return new SumMerkleTree(leaves)
  }

}
