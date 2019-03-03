export interface IEventWatcherStorage {

  getLoaded(initialBlock: number): number

  setLoaded(loaded: number): void

  addSeen(event: string): void

  getSeen(event: string): boolean

}

export class DefaultEventWatcherStorage implements IEventWatcherStorage {
  private loaded: number = 0
  private seen: { [key: string]: boolean} = {}

  constructor() {
  }

  getLoaded(initialBlock: number) {
    return this.loaded
  }

  setLoaded(loaded: number) {
    this.loaded = loaded
  }

  addSeen(event: string) {
    this.seen[event] = true
  }

  getSeen(event: string) {
    return this.seen[event]
  }

}
