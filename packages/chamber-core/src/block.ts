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
import { constants, utils } from 'ethers';
import {
  TOTAL_AMOUNT
} from './helpers/constants'
import {
  HexString,
  Hash,
  Address
} from './helpers/types'
import { DepositTransaction, TransactionDecoder } from './tx';
import { MapUtil } from './utils/MapUtil'

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
  superRoot: string | null
  timestamp: BigNumber
  isDepositBlock: boolean
  txs: SignedTransaction[]
  depositTx?: DepositTransaction
  tree: SumMerkleTree | null
  numTokens: number
  confSigMap: Map<string, string[]>

  constructor(numTokens?: number) {
    this.number = 0
    this.superRoot = null
    this.timestamp = constants.Zero
    this.isDepositBlock = false
    this.txs = []
    this.tree = null
    this.numTokens = numTokens || 1
    this.confSigMap = new Map<string, string[]>()
  }

  checkSuperRoot() {
    return utils.keccak256(
      utils.concat([
        utils.arrayify(this.getRoot()),
        utils.padZeros(utils.arrayify(this.timestamp), 8)
      ])
    )
  }

  verifySuperRoot() {
    if(this.superRoot != null) {
      return this.checkSuperRoot() === this.superRoot
    }else{
      throw new Error("superRoot doesn't setted")
    }
  }

  setSuperRoot(superRoot: string) {
    this.superRoot = superRoot
  }

  setBlockNumber(number: number) {
    this.number = number
  }

  setBlockTimestamp(bn: BigNumber) {
    this.timestamp = bn
  }
  
  setDepositTx(depositTx: DepositTransaction) {
    this.depositTx = depositTx
    this.isDepositBlock = true
  }

  appendTx(tx: SignedTransaction) {
    this.txs.push(tx)
  }

  appendConfSig(tx: SignedTransaction, confSig: string) {
    const hash = tx.hash()
    let confSigs = this.confSigMap.get(hash)
    if(confSigs && confSigs.indexOf(confSig) < 0) {
      confSigs.push(confSig)
      this.confSigMap.set(hash, confSigs)
    }
  }

  serialize() {
    return {
      number: this.number,
      isDepositBlock: this.isDepositBlock,
      depositTx: this.depositTx?this.depositTx.encode():null,
      txs: this.txs.map(tx => tx.serialize()),
      root: this.txs.length>0?this.getRoot():null,
      numTokens: this.numTokens,
      superRoot: this.superRoot,
      timestamp: this.timestamp.toString(),
      confSigs: MapUtil.serialize<string[]>(this.confSigMap)
    }
  }

  static deserialize(data: any): Block {
    let block = new Block(data.numTokens)
    block.setBlockNumber(data.number)
    block.setBlockTimestamp(ethers.utils.bigNumberify(data.timestamp))
    block.setSuperRoot(data.superRoot)
    if(data.depositTx !== null)
      block.setDepositTx(TransactionDecoder.decode(data.depositTx) as DepositTransaction)
    data.txs.forEach((tx: any) => {
      block.appendTx(SignedTransaction.deserialize(tx))
    })
    block.confSigMap = MapUtil.deserialize<string[]>(data.confSigs)
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
    return this.tree.proofs(
      this.numTokens,
      Buffer.from(hash.substr(2), 'hex'))
  }

  getSignedTransaction(hash: string): SignedTransaction {
    return this.txs.filter(tx => tx.hash() == hash)[0]
  }

  getSignedTransactionWithProof(hash: string) {
    if(this.superRoot != null) {
      const superRoot: string = this.superRoot
      const signedTx = this.getSignedTransaction(hash)
      const confSigs: string[] | undefined = this.confSigMap.get(hash)
      const proofs = this.getProof(hash)
      const outputMaps = signedTx.getSegments().map((s, i) => {return {"s":s, "i":i}}).filter(a => {
        return !a.s.getAmount().eq(0)
      }).map(a => a.i)
      return proofs.map((p, i) => {
        // outputMaps[i] is output index
        return new SignedTransactionWithProof(
          signedTx,
          outputMaps[i],
          superRoot,
          this.getRoot(),
          this.timestamp,
          p,
          utils.bigNumberify(this.number))
      }).map(tx => {
        if(confSigs) {
          return tx.withRawConfSigs(confSigs)
        } else {
          return tx
        }
      })
    }else{
      throw new Error("superRoot doesn't setted")
    }
  }

  getExclusionProof(segment: Segment): SumMerkleProof {
    if(this.tree === null) {
      this.tree = this.createTree()
    }
    const proof = this.tree.getProofByRange(
      this.numTokens,
      segment.getGlobalStart())
    if(proof == null) {
      throw new Error('exclusion proof not found')
    }
    return proof
  }

  checkInclusion(
    tx: SignedTransactionWithProof,
    segment: Segment
  ) {
    if(this.tree === null) {
      this.tree = this.createTree()
    }
    const proof = tx.getProof()
    return this.tree.verify(
      segment.getGlobalStart(),
      segment.getGlobalEnd(),
      Buffer.from(tx.signedTx.hash().substr(2), 'hex'),
      TOTAL_AMOUNT.mul(proof.numTokens),
      Buffer.from(this.getRoot().substr(2), 'hex'),
      proof
    )
  }

  /**
   * @description construct merkle tree
   *     by segments of the transaction output
   */
  createTree() {
    const numTokens = this.numTokens
    const leaves = Array(numTokens).fill(0).map((_, i) => {
      return this.createTokenTree(utils.bigNumberify(i))
    }).reduce((acc: SumMerkleTreeNode[], item: SumMerkleTreeNode[]) => {
      return acc.concat(item)
    }, [])

    return new SumMerkleTree(leaves)
  }

  createTokenTree(tokenId: BigNumber): SumMerkleTreeNode[] {
    let segments: SegmentNode[] = []
    this.txs.forEach(tx => {
      tx.getSegments().forEach(s => {
        if(tokenId.eq(s.getTokenId()) && s.getAmount().gt(0)) {
          segments.push(new SegmentNode(s, tx.hash()))
        }
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
        return acc.concat([new SegmentNode(new Segment(tokenId, prevEnd, segmentNode.segment.start), utils.keccak256(HashZero)), segmentNode])
      }else if(segmentNode.segment.start.eq(prevEnd)) {
        return acc.concat([segmentNode])
      }else{
        throw new Error('segment duplecated')
      }
    }, [])
    // add last exclusion segment
    if(nodes.length == 0) {
      // if there are no transaction
      nodes.push(new SegmentNode(
        new Segment(tokenId, ethers.constants.Zero, TOTAL_AMOUNT),
        utils.keccak256(HashZero)))
    }else{
      const lastSegment = nodes[nodes.length - 1].segment
      if(lastSegment.end.lt(TOTAL_AMOUNT)) {
        const lastExclusion = new SegmentNode(
          new Segment(tokenId, lastSegment.end, TOTAL_AMOUNT),
          utils.keccak256(HashZero))
        nodes.push(lastExclusion)
      }
    }
    return nodes.map(n => new SumMerkleTreeNode(
      n.tx,
      n.segment.getAmount()
    ))
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
