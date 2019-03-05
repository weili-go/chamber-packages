import * as ethers from 'ethers'
import JsonRpcProvider = ethers.providers.JsonRpcProvider
import { IEventWatcherStorage } from './storage'

export type RootChainEventHandler = (e: any) => void
export type CompletedHandler = () => void

export interface IETHEventAdaptor {

  parseLog(e: ethers.providers.Log): ethers.utils.LogDescription
  getLatestBlockNumber(): Promise<number>
  getLogs(fromBlockNumber: number, blockNumber: number, confirmation: number): Promise<ethers.providers.Log[]>

}

export class ETHEventAdaptor implements IETHEventAdaptor {
  address: string
  provider: JsonRpcProvider
  rootChainInterface: ethers.utils.Interface

  constructor(
    address: string,
    provider: JsonRpcProvider,
    rootChainInterface: ethers.utils.Interface
  ) {
    this.provider = provider
    this.rootChainInterface = rootChainInterface
    this.address = address
  }

  parseLog(e: ethers.providers.Log): ethers.utils.LogDescription {
    return this.rootChainInterface.parseLog(e)
  }

  async getLatestBlockNumber() {
    const block = await this.provider.getBlock('latest')
    return block.number
  }

  async getLogs(fromBlockNumber: number, blockNumber: number, confirmation: number) {
    const events = await this.provider.getLogs({
      address: this.address,
      fromBlock: fromBlockNumber - confirmation * 2,
      toBlock: blockNumber - confirmation
    })
    return events
  }
}

export type EventWatcherOptions = {
  initialBlock: number
  interval: number
  confirmation: number
}

export class EventWatcher {
  adaptor: IETHEventAdaptor
  storage: IEventWatcherStorage
  checkingEvents: Map<string, RootChainEventHandler>
  options: EventWatcherOptions
  
  constructor(
    adaptor: IETHEventAdaptor,
    storage: IEventWatcherStorage,
    options: EventWatcherOptions
  ) {
    this.adaptor = adaptor
    this.storage = storage
    this.checkingEvents = new Map<string, RootChainEventHandler>()
    this.options = Object.assign({}, {
      initialBlock: 1,
      interval: 1000,
      confirmation: 0
    }, options)
  }

  addEvent(event: string, handler: RootChainEventHandler) {
    this.checkingEvents.set(event, handler)
  }

  async initPolling(handler: CompletedHandler) {
    const blockNumber = await this.adaptor.getLatestBlockNumber()
    const loaded = await this.storage.getLoaded(this.options.initialBlock)
    await this.polling(loaded, blockNumber, handler)
    setTimeout(async ()=>{
      await this.initPolling(handler);
    }, this.options.interval);

  }

  async polling(fromBlockNumber: number, blockNumber: number, completedHandler: CompletedHandler) {
    const events = await this.adaptor.getLogs(
      fromBlockNumber,
      blockNumber,
      this.options.confirmation
    )
    const filtered = events.filter(e => {
      if(e.transactionHash)
        return !this.storage.getSeen(e.transactionHash)
      else
        return false
    }).map((e) => {
      const logDesc = this.adaptor.parseLog(e)
      const handler = this.checkingEvents.get(logDesc.name)
      if(handler) {
        handler(logDesc)
      }
      if(e.transactionHash) {
        this.storage.addSeen(e.transactionHash)
      }
      return true
    })
    await this.storage.setLoaded(blockNumber)
    if(filtered.length > 0) completedHandler()
  }
  
}
