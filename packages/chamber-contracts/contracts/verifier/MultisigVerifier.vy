# multisig

# atomic swap
@private
@constant
def verifySwap(
  _txHash: bytes32,
  _tBytes: bytes[1024],
  _sigs: bytes[130],
  _outputIndex: uint256,
  _owner: address,
  _start: uint256,
  _end: uint256
) -> (bool):
  #  label, maxBlkNum, from1, start1, end1, blkNum1, from2, start2, end2, blkNum2
  tList = RLPList(_tBytes, [
    address, uint256, uint256, uint256, address, uint256, uint256, uint256])
  return True

@private
@constant
def getTxoHashOfSwap(
  _tBytes: bytes[1024],
  _outputIndex: uint256,
  _blkNum: uint256
) -> (bytes32):
  return sha3("swap")

# multisig
@private
@constant
def verifyMultisig2(
  _txHash: bytes32,
  _tBytes: bytes[1024],
  _sigs: bytes[130],
  _outputIndex: uint256,
  _owner: address,
  _start: uint256,
  _end: uint256
) -> (bool):
  # label, maxBlkNum, lockstate, nextstate, from1, start1, end1, blkNum1, from2, start2, end2, blkNum2
  tList = RLPList(_tBytes, [
    uint256, uint256, bytes, bytes, address, uint256, uint256, uint256, address, uint256, uint256, uint256])
  return True

@private
@constant
def getTxoHashOfMultisig2(
  _tBytes: bytes[1024],
  _outputIndex: uint256,
  _blkNum: uint256
) -> (bytes32):
  return sha3("multisig2")
