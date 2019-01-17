operator: address

#
# Library
#

@private
@constant
def decodeSegment(_segmentBytes: bytes[64]) -> (uint256, uint256):    
  segmentList = RLPList(_segmentBytes, [uint256, uint256])
  return segmentList[0], segmentList[1]


# @dev Constructor
@public
def __init__():
  self.operator = msg.sender

@public
@constant
def get(_segmentBytes: bytes[64]) -> (uint256, uint256):
  return self.decodeSegment(_segmentBytes)
