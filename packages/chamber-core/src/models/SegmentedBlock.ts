import { Segment } from '../segment';
import { SignedTransactionWithProof } from '../SignedTransaction';
import { SumMerkleProof } from '../merkle';

export class ExclusionProof {
  proof: SumMerkleProof

  constructor(proof: SumMerkleProof) {
    this.proof = proof
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

}
