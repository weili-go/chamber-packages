import {
  IWalletStorage
} from './IWalletStorage'

export class MockWalletStorage implements IWalletStorage {
  add(key: string, value: string): boolean {
    return true
  }
  get(key: string): string {
    return ''
  }
  delete(key: string): boolean {
    return true
  }
  addProof(key: string, blkNum: number, value: string): Promise<boolean> {
    return Promise.resolve(true)
  }
  getProof(key: string, blkNum: number): Promise<string> {
    return Promise.resolve('')
  }
}