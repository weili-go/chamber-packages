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

# atomic swap
@public
@constant
def verifySwap(
  _txHash: bytes32,
  _merkleHash: bytes32,
  _tBytes: bytes[1024],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _start: uint256,
  _end: uint256
) -> (bool):
  #  from1, start1, end1, blkNum1, from2, start2, end2, blkNum2
  tList = RLPList(_tBytes, [
    address, uint256, uint256, uint256, address, uint256, uint256, uint256])
  check1: bool = self.ecrecoverSig(_txHash, slice(_sigs, start=0, len=65)) == tList[0]
  check2: bool = self.ecrecoverSig(_txHash, slice(_sigs, start=65, len=65)) == tList[4]
  check3: bool = self.ecrecoverSig(_merkleHash, slice(_sigs, start=130, len=65)) == tList[0]
  check4: bool = self.ecrecoverSig(_merkleHash, slice(_sigs, start=195, len=65)) == tList[4]
  if _owner != ZERO_ADDRESS:
    if _outputIndex == 0:
      assert _owner == tList[4]
    elif _outputIndex == 1:
      assert _owner == tList[0]
  if _outputIndex == 0:
    assert _start >= tList[1] and _end <= tList[2]
  elif _outputIndex == 1:
    assert _start >= tList[5] and _end <= tList[6]
  return check1 and check2

# not enough signature
@public
@constant
def verifySwapForceInclude(
  _txHash: bytes32,
  _merkleHash: bytes32,
  _tBytes: bytes[1024],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _start: uint256,
  _end: uint256,
  _hasSig: uint256
) -> (bool):
  #  from1, start1, end1, blkNum1, from2, start2, end2, blkNum2
  tList = RLPList(_tBytes, [
    address, uint256, uint256, uint256, address, uint256, uint256, uint256])
  check1: bool = self.ecrecoverSig(_txHash, slice(_sigs, start=0, len=65)) == tList[0]
  check2: bool = self.ecrecoverSig(_txHash, slice(_sigs, start=65, len=65)) == tList[4]
  if _outputIndex == 0:
    assert _start >= tList[1] and _end <= tList[2]
  elif _outputIndex == 1:
    assert _start >= tList[5] and _end <= tList[6]
  if _hasSig == 1:
    assert self.ecrecoverSig(_merkleHash, slice(_sigs, start=130, len=65)) == tList[0]
  elif _hasSig == 2:
    assert self.ecrecoverSig(_merkleHash, slice(_sigs, start=130, len=65)) == tList[4]
  return check1 and check2

@public
@constant
def getTxoHashOfSwap(
  _tBytes: bytes[1024],
  _index: uint256,
  _blkNum: uint256
) -> (bytes32):
  tList = RLPList(_tBytes, [
    address, uint256, uint256, uint256, address, uint256, uint256, uint256])
  if _index == 10:
    return self.getOwnState(tList[0], tList[1], tList[2], tList[3])
  elif _index == 11:
    return self.getOwnState(tList[4], tList[5], tList[6], tList[7])
  elif _index == 0:
    return self.getOwnState(tList[4], tList[1], tList[2], tList[3])
  else:
    return self.getOwnState(tList[0], tList[5], tList[6], tList[7])

  return sha3("swap")

# multisig
@public
@constant
def verifyMultisig2(
  _txHash: bytes32,
  _tBytes: bytes[1024],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _start: uint256,
  _end: uint256
) -> (bool):
  # label, maxBlkNum, lockstate, nextstate, from1, start1, end1, blkNum1, from2, start2, end2, blkNum2
  tList = RLPList(_tBytes, [
    uint256, uint256, bytes, bytes, address, uint256, uint256, uint256, address, uint256, uint256, uint256])
  return True

@public
@constant
def getTxoHashOfMultisig2(
  _tBytes: bytes[1024],
  _index: uint256,
  _blkNum: uint256
) -> (bytes32):
  return sha3("multisig2")
