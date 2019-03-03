import * as ethers from 'ethers'
import { PlasmaClient } from './PlasmaClient'
import { RootChainEventListener } from './event'
import {
  WalletStorage
} from '../storage/WalletStorage'
import {
  Address,
  Block,
  MapUtil,
} from '@layer2/core'
import { WaitingBlockWrapper } from '../models'
import artifact from '../assets/RootChain.json'
if(!artifact.abi) {
  console.error('ABI not found')
}


export class PlasmaSyncher {
  private client: PlasmaClient
  private storage: WalletStorage
  private httpProvider: ethers.providers.JsonRpcProvider
  private listener: RootChainEventListener
  private rootChainInterface: ethers.utils.Interface
  private waitingBlocks: Map<string, string>

  constructor(
    client: PlasmaClient,
    provider: ethers.providers.JsonRpcProvider,
    contractAddress: Address,
    storage: WalletStorage,
    options: any
  ) {
    this.client = client
    this.httpProvider = provider
    this.storage = storage
    this.waitingBlocks = this.storage.loadMap<string>('waitingBlocks')
    this.rootChainInterface = new ethers.utils.Interface(artifact.abi)
    this.listener = new RootChainEventListener(
      this.httpProvider,
      this.rootChainInterface,
      contractAddress,
      storage.getStorage(),
      options
    )
    this.listener.addEvent('BlockSubmitted', (e) => {
      console.log('BlockSubmitted', e)
      this.addWaitingBlock(new WaitingBlockWrapper(
        e.values._blkNum,
        e.values._root
      ))
    })
  }

  getListener() {
    return this.listener
  }

  /**
   * 
   * @param handler 
   * 
   * ```typescript
   * await wallet.init((wallet) => {})
   * ```
   */
  async init(handler: () => void) {
    await this.listener.initPolling(() => {
      handler()
    })
  }

  /**
   * @ignore
   */
  private async loadBlocks() {
    const tasks = this.getWaitingBlocks().map(block => {
      return this.client.getBlock(block.blkNum.toNumber())
    })
    return Promise.all(tasks)
  }

  async sync(
    handler: (block: Block) => Promise<void>
  ): Promise<void> {
    const results = await this.loadBlocks()
    const tasks = results.map(block => {
      if(block.isOk()) {
        const tasks = handler(block.ok())
        // When success to get block, remove the block from waiting block list
        this.deleteWaitingBlock(block.ok().number)
        return tasks
      } else {
        console.warn(block.error())
        return Promise.resolve()
      }
    })
    // send confirmation signatures
    await Promise.all(tasks)
  }

  getWaitingBlocks(): WaitingBlockWrapper[] {
    const arr: WaitingBlockWrapper[] = []
    this.waitingBlocks.forEach(value => {
      arr.push(WaitingBlockWrapper.deserialize(value))
    })
    return arr
  }

  /**
   * @ignore
   */
  private addWaitingBlock(tx: WaitingBlockWrapper) {
    this.waitingBlocks.set(tx.blkNum.toString(), tx.serialize())
    this.storage.storeMap('waitingBlocks', this.waitingBlocks)
  }

  /**
   * @ignore
   */
  private deleteWaitingBlock(blkNum: number) {
    this.waitingBlocks.delete(blkNum.toString())
    this.storage.storeMap('waitingBlocks', this.waitingBlocks)
  }
  
}
