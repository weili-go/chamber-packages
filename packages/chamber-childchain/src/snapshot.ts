import {
  SignedTransaction
} from '@layer2/core'
import { BigNumber } from 'ethers/utils';

export interface ISnapshotDb {
  contains(key: string): Promise<boolean>
  insertId(key: string): Promise<boolean>
  deleteId(key: string): Promise<boolean>
}

export class Snapshot {
  db: ISnapshotDb

  constructor(db: ISnapshotDb) {
    this.db = db
  }

  /**
   * check input of transaction
   * @param {SignedTransaction} signedTx SignedTransaction
   */
  checkInput(signedTx: SignedTransaction): Promise<boolean> {
    return Promise.all(signedTx.tx.getInputs().map((i) => {
      const id = i.hash();
      return this.db.contains(id);
    })).then((isContains) => {
      if(isContains.indexOf(false) >= 0) {
        throw new Error('input not found');
      }else{
        return Promise.all(signedTx.tx.getInputs().map((i) => {
          return this.db.deleteId(i.hash());
        }));
      }
    }).then(() => {
      return Promise.resolve(true);
    }).catch((e) => {
      return Promise.resolve(false);
    })
  }

  applyTx(signedTx: SignedTransaction, blkNum: BigNumber): Promise<boolean> {
    return Promise.all(signedTx.tx.getOutputs().map((o) => {
      return this.db.insertId(o.withBlkNum(blkNum).hash())
    })).then(() => {
      return Promise.resolve(true);
    }).catch((e) => {
      console.error(e);
      return Promise.resolve(false);
    })
  }

}
