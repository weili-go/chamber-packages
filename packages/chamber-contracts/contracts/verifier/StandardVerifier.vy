#
# Library
#

# @dev from https://github.com/LayerXcom/plasma-mvp-vyper
@private
@constant
def ecrecoverSig(_txHash: bytes32, _sig: bytes[65]) -> address:
  if len(_sig) != 65:
    return ZERO_ADDRESS
  # ref. https://gist.github.com/axic/5b33912c6f61ae6fd96d6c4a47afde6d
  # The signature format is a compact form of:
  # {bytes32 r}{bytes32 s}{uint8 v}
  r: uint256 = extract32(_sig, 0, type=uint256)
  s: uint256 = extract32(_sig, 32, type=uint256)
  v: int128 = convert(slice(_sig, start=64, len=1), int128)
  # Version of signature should be 27 or 28, but 0 and 1 are also possible versions.
  # geth uses [0, 1] and some clients have followed. This might change, see:
  # https://github.com/ethereum/go-ethereum/issues/2053
  if v < 27:
    v += 27
  if v in [27, 28]:
    return ecrecover(_txHash, convert(v, uint256), r, s)
  return ZERO_ADDRESS

@private
@constant
def getOwnState(
  owner: address,
  start: uint256,
  end: uint256,
  blkNum: uint256
) -> (bytes32):
  return sha3(
      concat("own",
        convert(owner, bytes32),
        convert(start, bytes32),
        convert(end, bytes32),
        convert(blkNum, bytes32)
      )
    )

# transfer
@private
@constant
def decodeTransfer(
  _tBytes: bytes[1024],
) -> (address, uint256, uint256, uint256, address):
  # from, start, end, blkNum, to
  return RLPList(_tBytes, [address, uint256, uint256, uint256, address])

# @dev Constructor
@public
def __init__():
  assert True

@public
@constant
def verifyTransfer(
  _txHash: bytes32,
  _tBytes: bytes[1024],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _start: uint256,
  _end: uint256
) -> (bool):
  # from, start, end, blkNum, to
  _from: address
  start: uint256
  end: uint256
  blkNum: uint256
  to: address
  (_from, start, end, blkNum, to) = self.decodeTransfer(_tBytes)
  if _owner != ZERO_ADDRESS:
    assert(_owner == to and _outputIndex == 0)
  return (self.ecrecoverSig(_txHash, slice(_sigs, start=0, len=65)) == _from) and (start <= _start) and (_end <= end)

@public
@constant
def getTxoHashOfTransfer(
  _txBytes: bytes[1024],
  _index: uint256,
  _blkNum: uint256
) -> (bytes32):
  # from, start, end, blkNum, to
  _from: address
  start: uint256
  end: uint256
  blkNum: uint256
  to: address
  (_from, start, end, blkNum, to) = self.decodeTransfer(_txBytes)
  if _index >= 10:
    return self.getOwnState(_from, start, end, blkNum)
  else:
    return self.getOwnState(to, start, end, _blkNum)

# split
@public
@constant
def verifySplit(
  _txHash: bytes32,
  _tBytes: bytes[1024],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _start: uint256,
  _end: uint256
) -> (bool):
  # from, start, end, blkNum, to1, to2, offset
  tList = RLPList(_tBytes, [address, uint256, uint256, uint256, address, address, uint256])
  if _owner != ZERO_ADDRESS:
    if _outputIndex == 0:
      assert(_owner == tList[4])
    else:
      assert(_owner == tList[5])
  if _outputIndex == 0:
    assert (_start >= tList[1]) and (_end <= tList[6])
  else:
    assert (_start >= tList[6]) and (_end <= tList[2])
  return (self.ecrecoverSig(_txHash, slice(_sigs, start=0, len=65)) == tList[0])

@public
@constant
def getTxoHashOfSplit(
  _txBytes: bytes[1024],
  _index: uint256,
  _blkNum: uint256
) -> (bytes32):
  tList = RLPList(_txBytes, [address, uint256, uint256, uint256, address, address, uint256])
  if _index >= 10:
    return self.getOwnState(tList[0], tList[1], tList[2], tList[3])
  elif _index == 0:
    return self.getOwnState(tList[4], tList[1], tList[6], _blkNum)
  else:
    return self.getOwnState(tList[5], tList[6], tList[2], _blkNum)

# merge
@public
@constant
def verifyMerge(
  _txHash: bytes32,
  _merkleHash: bytes32,
  _tBytes: bytes[1024],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _start: uint256,
  _end: uint256
) -> (bool):
  # from, start, offset, end, blkNum1, blkNum2, to
  tList = RLPList(_tBytes, [
    address, uint256, uint256, uint256, uint256, uint256, address])
  if _owner != ZERO_ADDRESS:
    assert(_owner == tList[6]) and (_start >= tList[1]) and (_end <= tList[3])
  assert self.ecrecoverSig(_merkleHash, slice(_sigs, start=65, len=65)) == tList[0]
  return (self.ecrecoverSig(_txHash, slice(_sigs, start=0, len=65)) == tList[0])

@public
@constant
def getTxoHashOfMerge(
  _txBytes: bytes[1024],
  _index: uint256,
  _blkNum: uint256
) -> (bytes32):
  tList = RLPList(_txBytes, [
    address, uint256, uint256, uint256, uint256, uint256, address])
  if _index == 10:
    return self.getOwnState(tList[0], tList[1], tList[2], tList[4])
  elif _index == 11:
    return self.getOwnState(tList[0], tList[2], tList[3], tList[5])
  else:
    return self.getOwnState(tList[6], tList[1], tList[3], _blkNum)
