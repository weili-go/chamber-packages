import { utils } from 'ethers'

export class HexUtil {

  static concat(hexStringList: string[]) {
    return utils.hexlify(utils.concat(hexStringList.map(hex => utils.arrayify(hex))))
  }

}
