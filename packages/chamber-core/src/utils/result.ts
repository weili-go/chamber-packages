import { ChamberError } from './error'

export interface ChamberResult<T> {
  isOk(): boolean
  isError(): boolean
  ok(): T
  error(): ChamberError
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

  error(): ChamberError {
    throw 'ok.error'
  }

}

export class ChamberResultError<T> implements ChamberResult<T> {
  private err: ChamberError

  constructor(error: ChamberError) {
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

  error(): ChamberError {
    return this.err
  }

  static getError<T>(code: number, message: string) {
    return new ChamberResultError<T>(new ChamberError(code, message))
  }

}
