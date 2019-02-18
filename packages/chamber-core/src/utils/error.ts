import { create } from 'handlebars';

export class ChamberError implements Error {
  public name = 'ChamberError';

  constructor(public code: number, public message: string) {
  }

  toString() {
    return this.name + ': ' + this.message;
  }

  serialize() {
    return {
      error: {
        code: this.code,
        message: this.message
      }
    }
  }

}
