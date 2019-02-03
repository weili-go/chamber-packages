import {
  SignedTransaction,
  SignedTransactionWithProof
} from './SignedTransaction'
import {
  SumMerkleTreeNode,
  SumMerkleProof,
  SumMerkleTree
} from './merkle'
import {
  Segment
} from './segment'
import * as ethers from 'ethers'
import { HashZero } from 'ethers/constants'
import { BigNumber } from 'ethers/utils'
import { utils } from 'ethers';
import {
  TOTAL_AMOUNT
} from './helpers/constants'
import {
  HexString,
  Hash,
  Address
} from './helpers/types'
import { DepositTransaction, TransactionDecoder } from './tx';

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
  isDepositBlock: boolean
  txs: SignedTransaction[]
  depositTx?: DepositTransaction
  tree: SumMerkleTree | null

  constructor() {
    this.number = 0
    this.isDepositBlock = false
    this.txs = []
    this.tree = null
  }

  setBlockNumber(number: number) {
    this.number = number
  }

  setDepositTx(depositTx: DepositTransaction) {
    this.depositTx = depositTx
    this.isDepositBlock = true
  }

  appendTx(tx: SignedTransaction) {
    this.txs.push(tx)
  }

  serialize() {
    return {
      number: this.number,
      isDepositBlock: this.isDepositBlock,
      depositTx: this.depositTx?this.depositTx.encode():null,
      txs: this.txs.map(tx => tx.serialize()),
      root: this.getRoot()
    }
  }

  static deserialize(data: any): Block {
    let block = new Block()
    block.setBlockNumber(data.number)
    if(data.depositTx !== null)
      block.setDepositTx(DepositTransaction.decode(data.depositTx))
    data.txs.forEach((tx: any) => {
      block.appendTx(SignedTransaction.deserialize(tx))
    })
    return block
  }

  getBlockNumber() {
    return this.number
  }

  getRoot(): Hash {
    if(this.tree === null) {
      this.tree = this.createTree()
    }
    return ethers.utils.hexlify(this.tree.root())
  }
  
  getProof(hash: string): SumMerkleProof[] {
    if(this.tree === null) {
      this.tree = this.createTree()
    }
    return this.tree.proofs(Buffer.from(hash.substr(2), 'hex'))
  }

  getSignedTransaction(hash: string): SignedTransaction {
    return this.txs.filter(tx => tx.hash() == hash)[0]
  }

  getSignedTransactionWithProof(hash: string) {
    const signedTx = this.getSignedTransaction(hash)
    return this.getProof(hash).map((p, i) => new SignedTransactionWithProof(
        signedTx,
        i,
        this.getRoot(),
        p,
        utils.bigNumberify(this.number)))
  }

  getExclusionProof(offset: BigNumber): SumMerkleProof {
    if(this.tree === null) {
      this.tree = this.createTree()
    }
    const proof = this.tree.getProofByRange(offset)
    if(proof == null) {
      throw new Error('exclusion proof not found')
    }
    return proof
  }

  checkInclusion(
    tx: SignedTransactionWithProof,
    start: BigNumber,
    end: BigNumber
  ) {
    if(this.tree === null) {
      this.tree = this.createTree()
    }
    return this.tree.verify(
      start,
      end,
      Buffer.from(tx.signedTx.hash().substr(2), 'hex'),
      TOTAL_AMOUNT,
      Buffer.from(this.getRoot().substr(2), 'hex'),
      tx.getProof()   
    )
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
        return acc.concat([new SegmentNode(new Segment(prevEnd, segmentNode.segment.start), utils.keccak256(HashZero)), segmentNode])
      }else if(segmentNode.segment.start.eq(prevEnd)) {
        return acc.concat([segmentNode])
      }else{
        throw new Error('segment duplecated')
      }
    }, [])
    // add last exclusion segment
    const lastSegment = nodes[nodes.length - 1].segment
    if(lastSegment.end.lt(TOTAL_AMOUNT)) {
      const lastExclusion = new SegmentNode(
        new Segment(lastSegment.end, TOTAL_AMOUNT),
        utils.keccak256(HashZero))
      nodes.push(lastExclusion)
    }
    const leaves = nodes.map(n => new SumMerkleTreeNode(
      n.tx,
      n.segment.getAmount()
    ))
    return new SumMerkleTree(leaves)
  }

  getTransactions() {
    return this.txs
  }

  getUserTransactions(owner: Address): SignedTransaction[] {
    return this.txs.filter(tx => {
      const hasOutput = tx.tx.getOutputs().filter(output => {
        return output.getOwners().indexOf(owner) >= 0
      }).length > 0
      const hasInput = tx.tx.getInputs().filter(input => {
        return input.getOwners().indexOf(owner) >= 0
      }).length > 0
      return hasOutput || hasInput
    })
  }

  getUserTransactionAndProofs(owner: Address): SignedTransactionWithProof[] {
    return this.getUserTransactions(owner).reduce((acc: SignedTransactionWithProof[], tx) => {
      return acc.concat(this.getSignedTransactionWithProof(tx.hash()))
    }, [])
  }

}
