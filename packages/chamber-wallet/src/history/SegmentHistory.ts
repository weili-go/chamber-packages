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
import { IStorage } from '../storage';
import { PlasmaClient } from '../client';

/**
 * The history of a segment
 */
export class SegmentHistory {
  key: string
  originalSegment: Segment
  storage: IStorage

  constructor(storage: IStorage, key: string, originalSegment: Segment) {
    this.key = key
    this.storage = storage
    this.originalSegment = originalSegment
  }

  getKey() {
    return this.key
  }

  async append(segmentedBlock: SegmentedBlock) {
    await this.storage.addProof(
      this.getKey(),
      segmentedBlock.getBlockNumber(),
      JSON.stringify(segmentedBlock.serialize())
    )
  }

  async getSegmentedBlock(blkNum: number) {
    const serialized = await this.storage.getProof(this.getKey(), blkNum)
    return SegmentedBlock.deserialize(JSON.parse(serialized))
  }

  async verify(
    segmentChecker: SegmentChecker,
    blkNum: number,
    root: string
  ) {
    // check this.history[blkNum] is exclusion proof or parent of childTxs
    const segmentedBlock = await this.getSegmentedBlock(blkNum)
    const items = segmentedBlock.getItems()
    items.forEach((item) => {
      if(item instanceof SignedTransactionWithProof) {
        const tx = item as SignedTransactionWithProof
        // check inclusion check
        if(!(tx.getRoot() == root && tx.checkInclusion())) {
          throw new Error('invalid history: fail to check inclusion')
        }
        if(segmentChecker.isContain(tx.getSignedTx())) {
          segmentChecker.spend(tx.getSignedTx())
          segmentChecker.insert(tx.getSignedTx(), ethers.utils.bigNumberify(blkNum))
        } else {
          throw new Error('invalid history')
        }
      } else if (item instanceof ExclusionProof) {
        const exclusionProof = item as ExclusionProof
        // check exclusion
        if(!(exclusionProof.getRoot() == root && exclusionProof.checkExclusion())) {
          throw new Error('invalid history: fail to check exclusion')
        }
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
  storage: IStorage
  client: PlasmaClient

  constructor(storage: IStorage, client: PlasmaClient) {
    this.storage = storage
    this.client = client
    this.deposits = []
    this.blockHeaders = []
    this.segmentChecker = new SegmentChecker()
    try {
      this.segmentChecker.deserialize(JSON.parse(this.storage.get('segmentChecker')))
    } catch(e) {
      console.warn(e)
    }
  }

  init(key: string, originalSegment: Segment) {
    this.segmentHistoryMap[key] = new SegmentHistory(this.storage, key, originalSegment)
  }

  appendDeposit(blkNum: number, deposit: DepositTransaction) {
    this.segmentChecker.insertDepositTx(deposit, ethers.utils.bigNumberify(blkNum))
    this.storage.add('segmentChecker', JSON.stringify(this.segmentChecker.serialize()))
  }

  async appendSegmentedBlock(key: string, segmentedBlock: SegmentedBlock) {
    if(!this.segmentHistoryMap[key]) {
      this.init(key, segmentedBlock.getOriginalSegment())
    }
    await this.segmentHistoryMap[key].append(segmentedBlock)
  }

  async appendBlockHeader(header: WaitingBlockWrapper) {
    this.blockHeaders.push(header)
    await this.storage.addBlockHeader(header.blkNum.toNumber(), header.serialize())
  }

  async getBlockHeader(blkNum: number) {
    const serialized = await this.storage.getBlockHeader(blkNum)
    return WaitingBlockWrapper.deserialize(serialized)
  }

  async loadBlockHeaders(fromBlkNum: number, toBlkNum: number) {
    const serialized = await this.storage.searchBlockHeader(fromBlkNum, toBlkNum)
    return serialized.map((s: any) => WaitingBlockWrapper.deserialize(s))
  }

  async verifyHistory(key: string) {
    const segmentChecker = new SegmentChecker()
    segmentChecker.deserialize(this.segmentChecker.serialize())
    return await this.verifyPart(segmentChecker, key, 0)
  }

  private async verifyPart(
    segmentChecker: SegmentChecker,
    key: string,
    fromBlkNum: number
  ): Promise<TransactionOutput[]> {
    // check segment history by this.blockHeaders
    const blockHeaders = await this.loadBlockHeaders(fromBlkNum, fromBlkNum + 100)
    if(blockHeaders.length > 0) {
      await this.verifyPart2(segmentChecker, key, blockHeaders, 2)
      return this.verifyPart(segmentChecker, key, fromBlkNum + 100)
    } else {
      return segmentChecker.leaves
    }
  }

  private async verifyPart2(
    segmentChecker: SegmentChecker,
    key: string,
    blockHeaders: WaitingBlockWrapper[],
    retryCounter: number
  ): Promise<TransactionOutput[]> {
    const blockHeader = blockHeaders.shift()
    if(blockHeader) {
      const blkNum = blockHeader.blkNum.toNumber()
      try {
        await this.segmentHistoryMap[key].verify(
          segmentChecker,
          blkNum,
          blockHeader.root)
      } catch(e) {
        if(e.message === 'invalid history') {
          throw e
        }
        console.warn(e)
        const result = await this.client.getBlock(blkNum)
        if(result.isOk() && retryCounter >= 0) {
          const segmentedBlock = result.ok().getSegmentedBlock(this.segmentHistoryMap[key].originalSegment)
          this.appendSegmentedBlock(key, segmentedBlock)
          // retry
          return await this.verifyPart2(
            segmentChecker,
            key,
            [blockHeader].concat(blockHeaders),
            retryCounter - 1)
        }
      }
      return await this.verifyPart2(
        segmentChecker,
        key,
        blockHeaders,
        2)
    } else {
      return segmentChecker.leaves
    }
  }

}
