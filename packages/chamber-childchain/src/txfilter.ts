import {
  SignedTransaction, Segment
} from '@layer2/core';

export class TxFilter {
  txHashes: Map<string, boolean>
  segments: Segment[]

  constructor() {
    this.txHashes = new Map<string, boolean>()
    this.segments = []
  }

  checkAndInsertTx(tx: SignedTransaction): boolean {
    if(!tx.verify()) {
      throw new Error('invalid transaction')
    }
    if(this.txHashes.get(tx.hash()) !== undefined) {
      throw new Error('conflicted transaction hash')
    }
    if(tx.getRawTx().getInputs().filter(input => {
      const target = input.getSegment(0)
      return this.segments.filter(segment => {
        return target.start.lt(segment.end) && target.end.gt(segment.start)
      }).length > 0
    }).length > 0) {
      throw new Error('conflicted segments')
    }
    this.txHashes.set(tx.hash(), true)
    this.segments = this.segments.concat(tx.getSegments())
    return true
  }

  clear() {
    this.txHashes.clear()
    this.segments = []
  }
}
