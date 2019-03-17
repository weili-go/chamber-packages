import { Segment } from '../segment';
import { SignedTransactionWithProof } from '../SignedTransaction';
import { SumMerkleProof, SumMerkleTree } from '../merkle';
import { constants, utils } from 'ethers'
import { TOTAL_AMOUNT } from '../helpers/constants'

export class ExclusionProof {
  root: string
  proof: SumMerkleProof

  constructor(
    root: string,
    proof: SumMerkleProof
  ) {
    this.root = root
    this.proof = proof
  }

  getRoot() {
    return this.root
  }

  checkExclusion() {
    return SumMerkleTree.verify(
      this.proof.segment.start,
      this.proof.segment.end,
      Buffer.from( utils.keccak256(constants.HashZero).substr(2), 'hex'),
      TOTAL_AMOUNT.mul(this.proof.numTokens),
      Buffer.from(this.root.substr(2), 'hex'),
      this.proof
    )
  }

  serialize() {
    return {
      type: 'E',
      root: this.root,
      proof: this.proof.serialize()
    }
  }

  static deserialize(data: any) {
    return new ExclusionProof(data.root, SumMerkleProof.deserialize(data.proof))
  }

}

type SegmentedBlockItem = SignedTransactionWithProof | ExclusionProof

export class SegmentedBlock {
  originalSegment: Segment
  items: SegmentedBlockItem[]
  blkNum: number

  constructor(
    originalSegment: Segment,
    items: SegmentedBlockItem[],
    blkNum: number
  ) {
    this.originalSegment = originalSegment
    this.items = items
    this.blkNum = blkNum
  }

  getOriginalSegment() {
    return this.originalSegment
  }

  getItems() {
    return this.items
  }

  getBlockNumber() {
    return this.blkNum
  }

  serialize() {
    return {
      originalSegment: this.originalSegment.serialize(),
      items: this.items.map(item => item.serialize()),
      blkNum: this.blkNum
    }
  }

  static deserialize(data: any) {
    return new SegmentedBlock(
      Segment.deserialize(data.originalSegment),
      data.items.map((item: any) => {
        if(item.type == 'E') {
          return ExclusionProof.deserialize(item)
        } else {
          return SignedTransactionWithProof.deserialize(item)
        }
      }),
      data.blkNum
    )
  }

}
