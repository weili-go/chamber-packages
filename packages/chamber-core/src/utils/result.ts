export interface ChamberResult<T> {
  isOk(): boolean
  isError(): boolean
  ok(): T
  error(): Error
}

export class ChamberOk<T> implements ChamberResult<T> {
  private value: T

  constructor(v: T) {
    this.value = v
  }

  isOk(): boolean {
    return true
  }

  isError(): boolean {
    return false
  }

  ok(): T {
    return this.value
  }

  error(): Error {
    throw 'ok.error'
  }

}

export class ChamberError<T> implements ChamberResult<T> {
  private err: Error

  constructor(error: Error) {
    this.err = error
  }

  isOk(): boolean {
    return false
  }

  isError(): boolean {
    return true
  }

  ok(): T {
    throw 'error.ok'
  }

  error(): Error {
    return this.err
  }

  static getError<T>(message: string) {
    return new ChamberError<T>(new Error(message))
  }

}
