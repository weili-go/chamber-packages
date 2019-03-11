# escrow

contract VerifierUtil():
  def ecrecoverSig(
    _txHash: bytes32,
    _sig: bytes[260],
    index: int128
  ) -> address: constant
  def parseSegment(
    segment: uint256
  ) -> (uint256, uint256, uint256): constant
  def encodeSegment(
    tokenId: uint256,
    start: uint256,
    end: uint256
  ) -> (uint256):constant
  def isContainSegment(
    segment: uint256,
    small: uint256
  ) -> (bool): constant

contract OwnStateVerifier():
  def encodeSpentEvidence(
    segment: uint256,
    blkNum: uint256,
    sigs: bytes[65]
  ) -> (bytes[256]): constant
  def encodeState(
    owner: address,
    segment: uint256,
    blkNum: uint256
  ) -> (bytes[256]): constant
  def decodeState(
    stateBytes: bytes[256]
  ) -> (address, uint256, uint256, uint256): constant

contract EscrowStateVerifier():
  def encodeSpentEvidence(
    segment: uint256,
    blkNum: uint256,
    sigs: bytes[65]
  ) -> (bytes[256]): constant
  def encodeState(
    owner: address,
    segment: uint256,
    blkNum: uint256,
    to: address,
    ttp: address,
    timeout: uint256
  ) -> (bytes[256]): constant
  def decodeState(
    stateBytes: bytes[256]
  ) -> (address, uint256, uint256, address, address, uint256): constant

verifierUtil: public(address)
ownStateVerifier: public(address)
escrowStateVerifier: public(address)

@private
@constant
def decodeEscrow(
  _txBytes: bytes[496],
) -> (address, uint256, uint256, address, address, uint256):
  # _from, segment, blkNum, ttp, to, timeout
  return (
    extract32(_txBytes, 0 + 16, type=address),
    extract32(_txBytes, 32 + 16, type=uint256),
    extract32(_txBytes, 64 + 16, type=uint256),
    extract32(_txBytes, 96 + 16, type=address),
    extract32(_txBytes, 128 + 16, type=address),
    extract32(_txBytes, 160 + 16, type=uint256))

# @dev Constructor
@public
def __init__(_verifierUtil: address, _ownStateVerifier: address, _escrowStateVerifier: address):
  self.verifierUtil = _verifierUtil
  self.ownStateVerifier = _ownStateVerifier
  self.escrowStateVerifier = _escrowStateVerifier

@public
@constant
def isExitGamable(
  _label: uint256,
  _txHash: bytes32,
  _merkleHash: bytes32,
  _txBytes: bytes[496],
  _sigs: bytes[260],
  _outputIndex: uint256,
  _owner: address,
  _segment: uint256
) -> (bool):
  _from: address
  segment: uint256
  blkNum: uint256
  ttp: address
  to: address
  timeout: uint256
  (_from, segment, blkNum, ttp, to, timeout) = self.decodeEscrow(_txBytes)
  if _owner != ZERO_ADDRESS:
    assert(_owner == _from or _owner == ttp or _owner == to)
  assert VerifierUtil(self.verifierUtil).isContainSegment(segment, _segment)
  if _label == 1:   # lock
    assert (VerifierUtil(self.verifierUtil).ecrecoverSig(_txHash, _sigs, 0) == _from)
    return True
  elif _label == 2: # unlock
    assert (VerifierUtil(self.verifierUtil).ecrecoverSig(_txHash, _sigs, 0) == ttp)
    return True
  elif _label == 3: # cancel
    assert (VerifierUtil(self.verifierUtil).ecrecoverSig(_txHash, _sigs, 0) == _from)
    return True
  return False

@public
@constant
def getOutput(
  _label: uint256,
  _txBytes: bytes[496],
  _txBlkNum: uint256,
  _index: uint256
) -> (bytes[256]):
  _from: address
  segment: uint256
  blkNum: uint256
  ttp: address
  to: address
  timeout: uint256
  (_from, segment, blkNum, ttp, to, timeout) = self.decodeEscrow(_txBytes)
  if _label == 1:   # lock
    return EscrowStateVerifier(self.escrowStateVerifier).encodeState(
      to, segment, _txBlkNum, to, ttp, timeout)
  elif _label == 2: # unlock
    return OwnStateVerifier(self.ownStateVerifier).encodeState(to, segment, _txBlkNum)
  elif _label == 3: # cancel
    return OwnStateVerifier(self.ownStateVerifier).encodeState(_from, segment, _txBlkNum)

@public
@constant
def getSpentEvidence(
  _label: uint256,
  _txBytes: bytes[496],
  _index: uint256,
  _sigs: bytes[65]
) -> (bytes[256]):
  _from: address
  segment: uint256
  blkNum: uint256
  ttp: address
  to: address
  timeout: uint256
  (_from, segment, blkNum, ttp, to, timeout) = self.decodeEscrow(_txBytes)
  if _label == 1: # lock
    return OwnStateVerifier(self.ownStateVerifier).encodeSpentEvidence(
      segment,
      blkNum,
      _sigs
    )
  else:
    return EscrowStateVerifier(self.escrowStateVerifier).encodeSpentEvidence(
      segment,
      blkNum,
      _sigs
    )

