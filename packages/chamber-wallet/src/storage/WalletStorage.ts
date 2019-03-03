import {
  ExitableRangeManager,
  MapUtil,
  SignedTransactionWithProof
} from '@layer2/core'
import {
  IStorage
} from './IStorage'
import { Exit } from '../models';

export class WalletStorage {
  storage: IStorage
  private utxos: Map<string, string>
  private exitList: Map<string, string>

  constructor(storage: IStorage) {
    this.storage = storage
    this.utxos = this.loadUTXO()
    this.exitList = this.loadExits()
  }

  getStorage() {
    return this.storage
  }

  getLoadedPlasmaBlockNumber(): number {
    try {
      return Number(this.storage.get('loadedBlockNumber'))
    } catch(e) {
      return 0
    }
  }

  setLoadedPlasmaBlockNumber(n: number) {
    this.storage.add('loadedBlockNumber', n.toString())
  }
  
  addUTXO(tx: SignedTransactionWithProof) {
    this.utxos.set(tx.getOutput().hash(), JSON.stringify(tx.serialize()))
    this.storeMap('utxos', this.utxos)
  }

  /**
   * @ignore
   */
  private loadUTXO() {
    return this.loadMap<string>('utxos')
  }

  /**
   * @ignore
   */
  deleteUTXO(key: string) {
    this.utxos.delete(key)
    this.storeMap('utxos', this.utxos)
  }

  getUTXOList(): SignedTransactionWithProof[] {
    const arr: SignedTransactionWithProof[] = []
    this.utxos.forEach(value => {
      arr.push(SignedTransactionWithProof.deserialize(JSON.parse(value)))
    })
    return arr
  }

  setExit(exit: Exit) {
    this.exitList.set(exit.getId(), exit.serialize())
    this.storeMap('exits', this.exitList)    
  }
  
  deleteExit(id: string) {
    this.exitList.delete(id)
    this.storeMap('exits', this.exitList)
  }

  getExitList(): Exit[] {
    const arr: Exit[] = []
    this.exitList.forEach(value => {
      arr.push(Exit.deserialize(value))
    })
    return arr
  }
  
  getExit(exitId: string): Exit | null {
    const serialized = this.exitList.get(exitId)
    if(serialized)
      return Exit.deserialize(serialized)
    return null
  }

  /**
   * @ignore
   */
  private loadExits() {
    return this.loadMap<string>('exits')
  }

  /**
   * @ignore
   */
  loadExitableRangeManager() {
    try {
      const loaded = this.storage.get('exitable')
      return ExitableRangeManager.deserialize(loaded)
    }catch(e) {
      return new ExitableRangeManager()
    }
  }

  /**
   * @ignore
   */
  saveExitableRangeManager(
    exitableRangeManager: ExitableRangeManager
  ) {
    this.storage.add('exitable', exitableRangeManager.serialize())
  }

  storeMap<T>(key: string, map: Map<string, T>) {
    this.storage.add(key, JSON.stringify(MapUtil.serialize<T>(map)))
  }
  
  loadMap<T>(key: string) {
    try {
      return MapUtil.deserialize<T>(JSON.parse(this.storage.get(key)))
    } catch (e) {
      return MapUtil.deserialize<T>({})
    }
  }

}