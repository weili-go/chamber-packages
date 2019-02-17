import {
  SignedTransaction
} from '@layer2/core';

export class TxFilter {
  txHashes: Map<string, boolean>

  constructor() {
    this.txHashes = new Map<string, boolean>()
  }

  checkAndInsertTx(tx: SignedTransaction): boolean {
    if(!tx.verify()) {
      throw new Error('invalid transaction')
    }
    if(this.txHashes.get(tx.hash()) !== undefined) {
      throw new Error('conflicted transaction hash')
    }
    this.txHashes.set(tx.hash(), true)
    return true
  }

  clear() {
    this.txHashes.clear()
  }
}
