import {
  IWalletStorage
} from './IWalletStorage'

export class MockWalletStorage implements IWalletStorage {
  data: Map<string, string>

  constructor() {
    this.data = new Map<string, string>()
  }

  add(key: string, value: string): boolean {
    this.data.set(key, value)
    return true
  }
  get(key: string): string {
    const value = this.data.get(key)
    if(value) return value
    else throw new Error(`key ${key} not found`)
  }
  delete(key: string): boolean {
    this.data.delete(key)
    return true
  }
  addProof(key: string, blkNum: number, value: string): Promise<boolean> {
    this.data.set(key, value)
    return Promise.resolve(true)
  }
  getProof(key: string, blkNum: number): Promise<string> {
    const value = this.data.get(key)
    if(value)
      return Promise.resolve(value)
    else
    return Promise.reject(new Error(`key ${key} not found`))
  }
}