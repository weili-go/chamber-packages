import { BigNumber, keccak256 } from 'ethers/utils';
import { HashZero } from 'ethers/constants';
import {
  Hash
} from './types'


/**
 * @title TotalAmount
 * total amount is 2^48
 */
export const TOTAL_AMOUNT = new BigNumber(2).pow(48)
export const ZERO_HASH: Hash = keccak256(HashZero)
