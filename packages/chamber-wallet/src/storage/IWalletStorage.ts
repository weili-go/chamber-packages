export interface IWalletStorage {
  add(key: string, value: string): boolean
  get(key: string): string
  delete(key: string): boolean
  addProof(key: string, blkNum: number, value: string): Promise<boolean>
  getProof(key: string, blkNum: number): Promise<string>
}
