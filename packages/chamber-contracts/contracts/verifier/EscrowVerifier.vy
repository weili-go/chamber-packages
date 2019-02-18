# escrow

# total deposit amount per token type
TOTAL_DEPOSIT: constant(uint256) = 2**48
MASK8BYTES: constant(uint256) = 2**64

# @dev from https://github.com/LayerXcom/plasma-mvp-vyper
@private
@constant
def ecrecoverSig(_txHash: bytes32, _sigs: bytes[260]) -> address:
  sig: bytes[65] = slice(_sigs, start=0, len=65)
  if len(sig) != 65:
    return ZERO_ADDRESS
  # ref. https://gist.github.com/axic/5b33912c6f61ae6fd96d6c4a47afde6d
  # The signature format is a compact form of:
  # {bytes32 r}{bytes32 s}{uint8 v}
  r: uint256 = extract32(sig, 0, type=uint256)
  s: uint256 = extract32(sig, 32, type=uint256)
  v: int128 = convert(slice(sig, start=64, len=1), int128)
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
def parseSegment(
  segment: uint256
) -> (uint256, uint256, uint256):
  tokenId: uint256 = bitwise_and(shift(segment, -16), MASK8BYTES)
  start: uint256 = bitwise_and(shift(segment, -8), MASK8BYTES)
  end: uint256 = bitwise_and(segment, MASK8BYTES)
  return (tokenId, start, end)

@private
@constant
def getOwnState(
  owner: address,
  tokenId: uint256,
  start: uint256,
  end: uint256,
  blkNum: uint256
) -> (bytes32):
  return sha3(
      concat("own",
        convert(owner, bytes32),
        convert(tokenId, bytes32),
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
  tokenId: uint256,
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
        convert(tokenId, bytes32),
        convert(start, bytes32),
        convert(end, bytes32),
        convert(blkNum, bytes32),
        convert(timeout, bytes32)
      )
    )

@private
@constant
def decodeEscrow(
  _txBytes: bytes[496],
) -> (address, uint256, uint256, address, address, uint256):
  # from, start, end, blkNum, ttp, to, timeout
  return (
    extract32(_txBytes, 0 + 16, type=address),
    extract32(_txBytes, 32 + 16, type=uint256),
    extract32(_txBytes, 64 + 16, type=uint256),
    extract32(_txBytes, 96 + 16, type=address),
    extract32(_txBytes, 128 + 16, type=address),
    extract32(_txBytes, 160 + 16, type=uint256))


@public
@constant
def verify(
  _label: uint256,
  _txHash: bytes32,
  _merkleHash: bytes32,
  _txBytes: bytes[496],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _tokenId: uint256,
  _start: uint256,
  _end: uint256,
  _timestamp: uint256
) -> (bool):
  _from: address
  segment: uint256
  tokenId: uint256
  start: uint256
  end: uint256
  blkNum: uint256
  ttp: address
  to: address
  timeout: uint256
  (_from, segment, blkNum, ttp, to, timeout) = self.decodeEscrow(_txBytes)
  (tokenId, start, end) = self.parseSegment(segment)
  assert _tokenId == tokenId and (start <= _start) and (_end <= end)
  if _label == 21:
    # lock escrow
    if _owner != ZERO_ADDRESS:
      assert((_owner == _from or _owner == ttp or _owner == to) and _outputIndex == 0)
    return (self.ecrecoverSig(_txHash, _sigs) == _from)
  elif _label == 22:
    # unlock escrow
    if _owner != ZERO_ADDRESS:
      assert(_owner == to and _outputIndex == 0)
    return (self.ecrecoverSig(_txHash, _sigs) == ttp)
  elif _label == 23:
    # timeout escrow
    if _owner != ZERO_ADDRESS:
      assert(_owner == _from and _outputIndex == 0)
    assert timeout >= _timestamp
    return (self.ecrecoverSig(_txHash, _sigs) == _from)

@public
@constant
def getTxoHashOfLockEscrow(
  _label: uint256,
  _txBytes: bytes[496],
  _index: uint256,
  _blkNum: uint256
) -> (bytes32):
  _from: address
  segment: uint256
  tokenId: uint256
  start: uint256
  end: uint256
  blkNum: uint256
  ttp: address
  to: address
  timeout: uint256
  (_from, segment, blkNum, ttp, to, timeout) = self.decodeEscrow(_txBytes)
  (tokenId, start, end) = self.parseSegment(segment)
  if _label == 21:
    # lock escrow
    if _index == 10:
      return self.getOwnState(_from, tokenId, start, end, blkNum)
    elif _index == 0:
      return self.getLockState(_from, ttp, to, tokenId, start, end, _blkNum, timeout)
  elif _label == 22:
    # unlock escrow
    if _index == 10:
      return self.getLockState(_from, ttp, to, tokenId, start, end, blkNum, timeout)
    elif _index == 0:
      return self.getOwnState(to, tokenId, start, end, _blkNum)
  elif _label == 23:
    # timeout escrow
    if _index == 10:
      return self.getLockState(_from, ttp, to, tokenId, start, end, blkNum, timeout)
    elif _index == 0:
      return self.getOwnState(_from, tokenId, start, end, _blkNum)
  return sha3("escrow")
