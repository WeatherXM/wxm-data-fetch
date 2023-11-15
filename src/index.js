const { ethers } = require('ethers')
const { parse } = require('date-fns')
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const commandLineArgs = require('command-line-args')
const commandLineUsage = require('command-line-usage')

const abi = require('./abis/abi.json')

const basin_storage_address = '0xd0ee658f1203302e35B9B9E3A73CB3472A2C2373' // Testnet basin storage address
const pubs_owner = '0x64251043A35ab5D11f04111B8BdF7C03BE9cF0e7' // Address used to sign uploads during testing
const rpc_url = 'https://api.calibration.node.glif.io/rpc/v1'
const pub_prefix = 'wxm2'

const MODE_RANGE = 'range'
const MODE_FULL = 'full'

const optionDefinitions = [
  { name: 'mode', type: String },
  { name: 'from', type: String},
  { name: 'to', type: String},
  { name: 'help', type: Boolean},
  { name: 'hot', type: Boolean},
]

const sections = [
  {
    content: 'Retrieves WXM data CIDs from basin with optional time range filtering'
  },
  {
    header: 'Options',
    optionList: [
      {
        name: 'mode',
        description: 'Can be "full" to fetch the entire set of CIDs or "range" to fetch CIDs for data in a specific day range'
      },
      {
        name: 'from',
        description: 'Ignore unless the mode is "range". The day from which to fetch data (eg. 2023_10_15)'
      },
      {
        name: 'to',
        description: 'Ignore unless the mode is "range". The day up to which to fetch data (eg. 2023_10_15)'
      },
      {
        name: 'hot',
        description: 'Boolean flag indicating if hot data should be fetched. Dat are considered hot before they have added in the Basin FVM data index'
      }
    ]
  }
]

const filterPubs = (pubs, fromDate, toDate) => {
  return pubs.filter(pub => {
    const isInNamespace = pub.includes('wxm2')
    if(!isInNamespace) {
      return false
    }

    // The publication name format is wxm2.date_2023_10_15 and we want only the date part
    const pubDate = pub.substring(10)
    const pubTs = Math.round(parse(pubDate, 'yyyy_MM_dd', new Date()).getTime() / 1000)
    const fromTs = Math.round(parse(fromDate, 'yyyy_MM_dd', new Date()).getTime() / 1000)
    const toTs = Math.round(parse(toDate, 'yyyy_MM_dd', new Date()).getTime() / 1000)

    return pubTs >= fromTs && pubTs <= toTs
  })
}

const getDataInRange = async (contractInstance, fromDate, toDate) => {
  const allPubs = await contractInstance.pubsOfOwner(pubs_owner)
  const filtered = filterPubs(allPubs, fromDate, toDate)

  const cids = await Promise.all(filtered.map(async pub => {
    const deals = await contractInstance.latestNDeals(pub, 1)

    return deals[0][2]
  }))


  return cids
}

const getAllData = async contractInstance => {
  const allPubs = await contractInstance.pubsOfOwner(pubs_owner)

  const filtered = allPubs.filter(pub => pub.includes(pub_prefix))

  const cids = await Promise.all(filtered.map(async pub => {
    const deals = await contractInstance.latestNDeals(pub, 1)

    return deals[0][2]
  }))

  return cids
}

const getDataInRangeInclHotInRange = async (fromDate, toDate) => {
  const { stdout, stderr } = await exec(`basin publication list --address ${pubs_owner}`);

  if(stderr) {
    throw new Error(stderr)
  }

  const allPubs = stdout.split("\n")
  const filtered = filterPubs(allPubs, fromDate, toDate)
  

  const cids = await Promise.all(filtered.map(async pub => {
    const { stdout: dealStr, stderr: readDealErr } = await exec(`basin publication deals --publication ${pub} --format json`);
    if(readDealErr) {
      throw new Error(readDealErr)
    }

    const dealObj = JSON.parse(dealStr)

    return dealObj[0].cid
  }))

  return cids
}

const getAllDataInRangeInclHot = async () => {
  const { stdout, stderr } = await exec(`basin publication list --address ${pubs_owner}`);

  if(stderr) {
    throw new Error(stderr)
  }

  const allPubs = stdout.split("\n")

  const cids = await Promise.all(allPubs.map(async pub => {
    if(!pub) {
      return
    }
    const { stdout: dealStr, stderr: readDealErr } = await exec(`basin publication deals --publication ${pub} --format json`);
    if(readDealErr) {
      throw new Error(readDealErr)
    }

    const dealObj = JSON.parse(dealStr)

    return dealObj[0].cid
  }))


  return cids
}


const main = async () => {
  const options = commandLineArgs(optionDefinitions)

  if(options.help) {
    console.log(commandLineUsage(sections))

    return
  }

  const provider = new ethers.JsonRpcProvider(rpc_url)
  const contractInstance = new ethers.Contract(basin_storage_address, abi, provider)

  if(options.mode === MODE_FULL) {
    const all = options.hot ? await getAllDataInRangeInclHot(contractInstance) : await getAllData(contractInstance)

    console.log (all)
  } else if(options.mode === MODE_RANGE) {
    const filterred = options.hot ? await getDataInRangeInclHotInRange(options.from, options.to) : await getDataInRange(contractInstance, options.from, options.to)

    console.log (filterred)
  } else {
    throw new Error(`Mode ${options.mode} is not supported`)
  }
}

main().then(() => {})
