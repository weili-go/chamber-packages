import * as ethers from 'ethers'
import JsonRpcProvider = ethers.providers.JsonRpcProvider
import {
  IStorage
} from '../storage'

export type RootChainEventHandler = (e: any) => void
export type CompletedHandler = () => void

export interface IEventWatcherStorage {

  getLoaded(initialBlock: number): number

  setLoaded(loaded: number): void

  addSeen(event: string): void

  getSeen(event: string): boolean

}

export class DefaultEventWatcherStorage implements IEventWatcherStorage {
  storage: IStorage
  private seen: { [key: string]: boolean} = {}

  constructor(storage: IStorage) {
    this.storage = storage
  }

  getLoaded(initialBlock: number) {
    const loaded = this.storage.get('loaded')
    if(loaded) {
      return parseInt(loaded)
    } else {
      return initialBlock
    }
  }

  setLoaded(loaded: number) {
    this.storage.add('loaded', loaded.toString())
  }

  addSeen(event: string) {
    this.seen[event] = true
  }

  getSeen(event: string) {
    return this.seen[event]
  }

}

export class RootChainEventListener {
  provider: JsonRpcProvider
  rootChainInterface: ethers.utils.Interface
  address: string
  storage: IEventWatcherStorage
  checkingEvents: Map<string, RootChainEventHandler>
  options: any
  initialBlock: number
  interval: number
  
  constructor(
    provider: JsonRpcProvider,
    rootChainInterface: ethers.utils.Interface,
    address: string,
    storage: IStorage,
    options: any
  ) {
    this.provider = provider
    this.rootChainInterface = rootChainInterface
    this.address = address
    this.storage = new DefaultEventWatcherStorage(storage)
    this.checkingEvents = new Map<string, RootChainEventHandler>()
    this.options = options || {}
    this.initialBlock = this.options.initialBlock || 1
    this.interval = this.options.interval || 10000
  }

  addEvent(event: string, handler: RootChainEventHandler) {
    this.checkingEvents.set(event, handler)
  }

  async initPolling(handler: CompletedHandler) {
    const block = await this.provider.getBlock('latest')
    const loaded = this.storage.getLoaded(this.initialBlock)
    await this.polling(loaded, block.number, handler)
    setTimeout(async ()=>{
      await this.initPolling(handler);
    }, this.interval);

  }

  async polling(fromBlockNumber: number, blockNumber: number, completedHandler: CompletedHandler) {
    const events = await this.provider.getLogs({
      address: this.address,
      fromBlock: fromBlockNumber,
      toBlock: blockNumber
    })
    const filtered = events.filter(e => {
      if(e.transactionHash)
        return !this.storage.getSeen(e.transactionHash)
      else
        return false
    }).map((e) => {
      const logDesc = this.rootChainInterface.parseLog(e)
      const handler = this.checkingEvents.get(logDesc.name)
      if(handler) {
        handler(logDesc)
      }
      if(e.transactionHash) {
        this.storage.addSeen(e.transactionHash)
      }
      return true
    })
    this.storage.setLoaded(blockNumber)
    if(filtered.length > 0) completedHandler()
  }
  
}
