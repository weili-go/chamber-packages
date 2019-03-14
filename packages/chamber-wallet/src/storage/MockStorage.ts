import {
  IStorage
} from './IStorage'
import { promises } from 'fs';

export class MockStorage implements IStorage {
  data: Map<string, string>
  blockHeaders: Map<number, string>

  constructor() {
    this.data = new Map<string, string>()
    this.blockHeaders = new Map<number, string>()
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
    this.data.set(key + '.' + blkNum, value)
    return Promise.resolve(true)
  }
  getProof(key: string, blkNum: number): Promise<string> {
    const value = this.data.get(key+ '.' + blkNum)
    if(value)
      return Promise.resolve(value)
    else
    return Promise.reject(new Error(`key ${key} not found`))
  }
  addBlockHeader(blkNum: number, value: string): Promise<boolean> {
    this.blockHeaders.set(blkNum, value)
    return Promise.resolve(true)
  }
  getBlockHeader(blkNum: number): Promise<string> {
    const value = this.blockHeaders.get(blkNum)
    if(value)
      return Promise.resolve(value)
    else
    return Promise.reject(new Error(`key ${blkNum} not found`))
  }
  searchBlockHeader(fromBlkNum: number, toBlkNum: number): Promise<string[]> {
    const arr: string[] = []
    this.blockHeaders.forEach((val, key) => {
      if(key >= fromBlkNum && key < toBlkNum)
        arr.push(val)
    })
    return Promise.resolve(arr)
  }
}