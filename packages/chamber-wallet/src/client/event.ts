import * as ethers from 'ethers'
import JsonRpcProvider = ethers.providers.JsonRpcProvider
import {
  IWalletStorage
} from '../storage'

export type RootChainEventHandler = (e: any) => void

export class RootChainEventListener {
  provider: JsonRpcProvider
  rootChainInterface: ethers.utils.Interface
  address: string
  storage: IWalletStorage
  seenEvents: Map<string, boolean>
  confirmation: number
  checkingEvents: Map<string, RootChainEventHandler>

  constructor(
    provider: JsonRpcProvider,
    rootChainInterface: ethers.utils.Interface,
    address: string,
    storage: IWalletStorage,
    seenEvents: Map<string, boolean>,
    confirmation: number
  ) {
    this.provider = provider
    this.rootChainInterface = rootChainInterface
    this.address = address
    this.storage = storage
    this.seenEvents = seenEvents || new Map<string, boolean>()
    this.checkingEvents = new Map<string, RootChainEventHandler>()
    this.confirmation = confirmation || 1
  }

  addEvent(event: string, handler: RootChainEventHandler) {
    this.checkingEvents.set(event, handler)
  }

  async initPolling() {
    const block = await this.provider.getBlock('latest')
    const loaded = Number(this.storage.get('loaded') || (block.number - 2))
    await this.polling(loaded, block.number)
    this.storage.add('seenEvents', JSON.stringify(this.seenEvents))
    setTimeout(async ()=>{
      await this.initPolling();
    }, 10000);

  }

  async polling(fromBlockNumber: number, blockNumber: number) {
    const events = await this.provider.getLogs({
      address: this.address,
      fromBlock: fromBlockNumber,
      toBlock: blockNumber
    })
    events.filter(e => {
      if(e.transactionHash)
        return !this.seenEvents.get(e.transactionHash)
      else
        return false
    }).forEach((e) => {
      const logDesc = this.rootChainInterface.parseLog(e)
      const handler = this.checkingEvents.get(logDesc.name)
      if(handler) {
        handler(logDesc)
      }
      if(e.transactionHash)
        this.seenEvents.set(e.transactionHash, true)
    })
    this.storage.add('loaded', blockNumber.toString())
  }
  
}
