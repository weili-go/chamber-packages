# multisig

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

@private
@constant
def getLockState(
  owner: address,
  ttp: address,
  to: address,
  start: uint256,
  end: uint256,
  blkNum: uint256,
  timeout: uint256
) -> (bytes32):
  return sha3(
      concat("escrow",
        convert(owner, bytes32),
        convert(ttp, bytes32),
        convert(to, bytes32),
        convert(start, bytes32),
        convert(end, bytes32),
        convert(blkNum, bytes32),
        convert(timeout, bytes32)
      )
    )

@public
@constant
def verify(
  _label: uint256,
  _txHash: bytes32,
  _merkleHash: bytes32,
  _tBytes: bytes[1024],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _start: uint256,
  _end: uint256
) -> (bool):
  #  from, start, end, blkNum, ttp, to, timeout
  tList = RLPList(_tBytes, [
    address, uint256, uint256, uint256, address, address, uint256])
  if _label == 21:
    # lock escrow
    if _owner != ZERO_ADDRESS:
      assert((_owner == tList[0] or _owner == tList[4] or _owner == tList[5]) and _outputIndex == 0)
    return (self.ecrecoverSig(_txHash, slice(_sigs, start=0, len=65)) == tList[0]) and (tList[1] <= _start) and (_end <= tList[2])
  elif _label == 22:
    # unlock escrow
    if _owner != ZERO_ADDRESS:
      assert(_owner == tList[5] and _outputIndex == 0)
    return (self.ecrecoverSig(_txHash, slice(_sigs, start=0, len=65)) == tList[4]) and (tList[1] <= _start) and (_end <= tList[2])
  elif _label == 23:
    # timeout escrow
    if _owner != ZERO_ADDRESS:
      assert(_owner == tList[0] and _outputIndex == 0)
    assert tList[6] >= as_unitless_number(block.timestamp)
    return (self.ecrecoverSig(_txHash, slice(_sigs, start=0, len=65)) == tList[0]) and (tList[1] <= _start) and (_end <= tList[2])

@public
@constant
def getTxoHashOfLockEscrow(
  _label: uint256,
  _tBytes: bytes[1024],
  _index: uint256,
  _blkNum: uint256
) -> (bytes32):
  #  from, start, end, blkNum, ttp, to, timeout
  tList = RLPList(_tBytes, [
    address, uint256, uint256, uint256, address, address, uint256])
  if _label == 21:
    # lock escrow
    if _index == 10:
      return self.getOwnState(tList[0], tList[1], tList[2], tList[3])
    elif _index == 0:
      return self.getLockState(tList[0], tList[4], tList[5], tList[1], tList[2], _blkNum, tList[6])
  elif _label == 22:
    # unlock escrow
    if _index == 10:
      return self.getLockState(tList[0], tList[4], tList[5], tList[1], tList[2], tList[3], tList[6])
    elif _index == 0:
      return self.getOwnState(tList[5], tList[1], tList[2], _blkNum)
  elif _label == 23:
    # timeout escrow
    if _index == 10:
      return self.getLockState(tList[0], tList[4], tList[5], tList[1], tList[2], tList[3], tList[6])
    elif _index == 0:
      return self.getOwnState(tList[0], tList[1], tList[2], _blkNum)
  return sha3("escrow")
