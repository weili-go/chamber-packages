import {
  Segment,
  SegmentChecker,
  SegmentedBlock,
  SignedTransactionWithProof,
  ExclusionProof,
  TransactionOutput,
  DepositTransaction
} from '@layer2/core';
import { WaitingBlockWrapper } from '../models';
import { ethers } from 'ethers';

/**
 * The history of a segment
 */
export class SegmentHistory {
  originalSegment: Segment
  history: SegmentedBlock[]

  constructor(originalSegment: Segment) {
    this.originalSegment = originalSegment
    this.history = []
  }

  append(segmentedBlock: SegmentedBlock) {
    this.history[segmentedBlock.getBlockNumber()] = segmentedBlock
  }

  verify(
    segmentChecker: SegmentChecker,
    blkNum: number
  ) {
    // check this.history[blkNum] is exclusion proof or parent of childTxs
    const items = this.history[blkNum].getItems()
    items.forEach((item) => {
      if(item instanceof SignedTransactionWithProof) {
        const tx = item as SignedTransactionWithProof
        // check inclusion check
        if(segmentChecker.isContain(tx.getSignedTx())) {
          segmentChecker.spend(tx.getSignedTx())
          segmentChecker.insert(tx.getSignedTx(), ethers.utils.bigNumberify(blkNum))
        } else {
          throw new Error('invalid history')
        }
      } else if (item instanceof ExclusionProof) {
        const exclusionProof = item as ExclusionProof
        // check exclusion check
      } else {
        throw new Error('invalid type')
      }
    })
    return true
  }

}

/**
 * The manager for multiple segments history
 */
export class SegmentHistoryManager {

  segmentHistoryMap: {[key: string]: SegmentHistory} = {}
  blockHeaders: WaitingBlockWrapper[]
  deposits: DepositTransaction[]
  segmentChecker: SegmentChecker

  constructor() {
    this.deposits = []
    this.blockHeaders = []
    this.segmentChecker = new SegmentChecker()
  }

  init(key: string, originalSegment: Segment) {
    this.segmentHistoryMap[key] = new SegmentHistory(originalSegment)
  }

  appendDeposit(blkNum: number, deposit: DepositTransaction) {
    this.segmentChecker.insertDepositTx(deposit, ethers.utils.bigNumberify(blkNum))
  }

  appendSegmentedBlock(key: string, segmentedBlock: SegmentedBlock) {
    this.segmentHistoryMap[key].append(segmentedBlock)
  }

  appendBlockHeader(header: WaitingBlockWrapper) {
    this.blockHeaders.push(header)
  }

  verifyHistory(key: string) {
    const segmentChecker = new SegmentChecker()
    segmentChecker.deserialize(this.segmentChecker.serialize())
    return this.verifyPart(segmentChecker, key, 0)
  }

  private verifyPart(
    segmentChecker: SegmentChecker,
    key: string,
    pointer: number
  ): TransactionOutput[] {
    // check segment history by this.blockHeaders
    if(pointer < this.blockHeaders.length) {
      const blkNum = this.blockHeaders[pointer].blkNum.toNumber()
      this.segmentHistoryMap[key].verify(segmentChecker, blkNum)
      return this.verifyPart(
        segmentChecker,
        key,
        pointer + 1)
    } else {
      return segmentChecker.leaves
    }
  }

  private checkDeposits(from: number, to: number, txs: SignedTransactionWithProof[]) {
    if(from + 1 < to) {
      for(let i = from + 1; i < to; i++) {
        txs = this.checkDeposit(i, txs)
      }
    }
    return txs
  }

  private checkDeposit(depositBlkNum: number, txs: SignedTransactionWithProof[]) {
    return txs.filter(tx => {
      return tx.getSignedTx().getAllInputs().filter(input => {
        return this.deposits[depositBlkNum].getOutput().isSpent(input)
      }).length == 0
    })
  }

}
