contract StandardVerifier():
  def verifyTransfer(
    _txHash: bytes32,
    _txBytes: bytes[1024],
    _sigs: bytes[130],
    _outputIndex: uint256,
    _owner: address,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHashOfTransfer(
    _txBytes: bytes[1024],
    _outputIndex: uint256,
    _blkNum: uint256
  ) -> bytes32: constant
  def verifySplit(
    _txHash: bytes32,
    _txBytes: bytes[1024],
    _sigs: bytes[130],
    _outputIndex: uint256,
    _owner: address,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHashOfSplit(
    _txBytes: bytes[1024],
    _outputIndex: uint256,
    _blkNum: uint256
  ) -> bytes32: constant
  def verifyMerge(
    _txHash: bytes32,
    _txBytes: bytes[1024],
    _sigs: bytes[130],
    _outputIndex: uint256,
    _owner: address,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHashOfMerge(
    _txBytes: bytes[1024],
    _outputIndex: uint256,
    _blkNum: uint256
  ) -> bytes32: constant


contract MultisigVerifier():
  def verifySwap(
    _txHash: bytes32,
    _txBytes: bytes[1024],
    _sigs: bytes[130],
    _outputIndex: uint256,
    _owner: address,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHashOfSwap(
    _txBytes: bytes[1024],
    _outputIndex: uint256,
    _blkNum: uint256
  ) -> bytes32: constant
  def verifyMultisig2(
    _txHash: bytes32,
    _txBytes: bytes[1024],
    _sigs: bytes[130],
    _outputIndex: uint256,
    _owner: address,
    _start: uint256,
    _end: uint256
  ) -> bool: constant
  def getTxoHashOfMultisig2(
    _txBytes: bytes[1024],
    _outputIndex: uint256,
    _blkNum: uint256
  ) -> bytes32: constant

stdverifier: address
multisigverifier: address

@private
@constant
def decodeBaseTx(_tBytes: bytes[1024]) -> (uint256, bytes[1024]):
  # label, body
  txList = RLPList(_tBytes, [
    uint256, bytes])
  return txList[0], txList[1]

# @dev Constructor
@public
def __init__(_stdverifier: address, _multisig: address):
  self.stdverifier = _stdverifier
  self.multisigverifier = _multisig

# @dev verify the transaction is signed correctly
@public
@constant
def verify(
  _txHash: bytes32,
  _txBytes: bytes[1024],
  _sigs: bytes[130],
  _outputIndex: uint256,
  _owner: address,
  _start: uint256,
  _end: uint256
) -> bool:
  label: uint256
  body: bytes[1024]
  (label, body) = self.decodeBaseTx(_txBytes)
  if label == 1:
    return StandardVerifier(self.stdverifier).verifyTransfer(_txHash, body, _sigs, _outputIndex, _owner, _start, _end)
  elif label == 2:
    return StandardVerifier(self.stdverifier).verifySplit(_txHash, body, _sigs, _outputIndex, _owner, _start, _end)
  elif label == 3:
    return StandardVerifier(self.stdverifier).verifyMerge(_txHash, body, _sigs, _outputIndex, _owner, _start, _end)
  elif label == 4:
    return MultisigVerifier(self.multisigverifier).verifySwap(_txHash, body, _sigs, _outputIndex, _owner, _start, _end)
  elif label == 10:
    return MultisigVerifier(self.multisigverifier).verifyMultisig2(_txHash, body, _sigs, _outputIndex, _owner, _start, _end)
  return False

# @dev get hash of input state of the transaction
@public
@constant
def getTxoHash(
  _txBytes: bytes[1024],
  _index: uint256,
  _blkNum: uint256
) -> bytes32:
  label: uint256
  body: bytes[1024]
  (label, body) = self.decodeBaseTx(_txBytes)
  if label == 1:
    return StandardVerifier(self.stdverifier).getTxoHashOfTransfer(body, _index, _blkNum)
  elif label == 2:
    return StandardVerifier(self.stdverifier).getTxoHashOfSplit(body, _index, _blkNum)
  elif label == 3:
    return StandardVerifier(self.stdverifier).getTxoHashOfMerge(body, _index, _blkNum)
  elif label == 4:
    return MultisigVerifier(self.multisigverifier).getTxoHashOfSwap(body, _index, _blkNum)
  elif label == 10:
    return MultisigVerifier(self.multisigverifier).getTxoHashOfMultisig2(body, _index, _blkNum)
  return sha3("txo")

# check segment within the transaction
@public
@constant
def checkWithin(
  _start: uint256,
  _end: uint256,
  _txBytes: bytes[1024]
) -> bool:
  return True
