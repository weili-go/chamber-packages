BlockSubmitted: event({_root: bytes32, _timestamp: timestamp})

operator: address

# @dev Constructor
@public
def __init__():
  self.operator = msg.sender

@public
def submit(_root: bytes32):
  assert msg.sender == self.operator
  log.BlockSubmitted(_root, block.timestamp)

