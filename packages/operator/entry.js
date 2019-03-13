#! /usr/bin/env node

const {
  ChainManager,
  MongoDown
} = require('./lib');
const Rpc = require('./lib/JsonRpc');
const leveldown = require('leveldown');
const path = require('path')
const fs = require('fs')

function getStorageOption() {
  const basePath = process.env.DB_BASEPATH || path.join(process.cwd(), '.plasmadb')
  const storage = process.env.STORAGE || 'leveldown';
  if(storage == 'leveldown') {
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath);
    }
    const fsOptions = {
      blockdb: leveldown(path.join(basePath, 'blockdb') ),
      metadb: leveldown(path.join(basePath, 'metadb')),
      snapshotdb: leveldown(path.join(basePath, 'snapshotdb'))
    }
    return fsOptions;
  }else if(storage == 'mongodb') {
    const mongoOptions = {
      blockdb: new MongoDown('blockdb'),
      metadb: new MongoDown('metadb'),
      snapshotdb: new MongoDown('snapshotdb')
    }
    return mongoOptions
  }
}

async function main(){
  const chainManager = new ChainManager(
    process.env.OPERATOR_PRIVATE_KEY,
    process.env.ROOTCHAIN_ENDPOINT,
    process.env.ROOTCHAIN_ADDRESS
  );
  const options = {
    confirmation: process.env.MAINCHAIN_CONFIRMATION,
    initialBlock: process.env.MAINCHAIN_INITIAL_BLOCK
  }
  await chainManager.start(
    Object.assign({}, options, getStorageOption()))
  Rpc.run(chainManager.getChain());
  return true;
}

main()
  .then(() => console.log('Chain running. RPC running.') )
  .catch(e=> console.error(e) );
