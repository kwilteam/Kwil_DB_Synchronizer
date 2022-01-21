require(`dotenv`).config();
const knex = require('../../database/db');
const {storePhotos} = require('../filesystem/fileWriter.js')
const axios = require('axios');
const { wait } = require('./bundleHandlers');
const {pool} = require('../../database/startup.js');
const utils = require('./utils.js')

// Syncs node data with bundles referenced on Harmony network.
const syncNode = async () => {
    if (process.env.SYNC == false.toString()) {return}
    
    const moats = process.env.SYNCED_DATA_MOATS.split(" ");

    // Loops through all data moats, and scans Harmony network for new Kwil bundles.
    // Stores bundle metadata to the local node DB.
    for (let i = 0; i<moats.length; i++) {
        let latestCursor = await knex('bundles').select('cursor_id').where({synced: true}).orderBy('height', 'desc').limit(1)

        if (latestCursor.length == 0) {
            latestCursor = ''
        } else {
            latestCursor = latestCursor[0].cursor_id
        }
        const bundleMetaData = await scanBundles(moats[i], latestCursor);
        // Loops through and stores new Kwil bundle metadata to node database.
        for (let j = 0; j<bundleMetaData.length; j++) {
            try {
                //THis is in try catch since the Arweave gateway can be later than the chain.  This will lead to a null blockheight.  We only want to store confirmed block heights
                    await knex('bundles').insert({
                    bundle_id: bundleMetaData[j].node.id,
                    height: bundleMetaData[j].node.block.height,
                    cursor_id: bundleMetaData[j].cursor,
                    synced: false,
                    moat: moats[i]
                });
            } catch(e) {
                console.log(`Bundle ${bundleMetaData[j].node.id} could not be stored right now.  It is either newly mined, or was already stored`);
            };
        };
    };
    // Assuming all new bundle information from Harmony gets loaded to the node database,
    // syncScannedBundles pulls unsynced bundle data from ARWeave.
    await syncScannedBundles();
};

// Syncs unsynced bundle data from ARWeave assuming new bundle metadata has been pulled from Harmony.
const syncScannedBundles = async () => {
    const bundles = await knex('bundles').select('bundle_id').where({
        synced: false
    }).orderBy('height', 'asc');;
    for (let i = 0; i<bundles.length; i++) {
        try {
        const params = {
            url: `${process.env.ARWEAVE_GRAPH_HOST}/${bundles[i].bundle_id}`,
            method: 'get',
            timeout: 20000
        };
        const response = await axios(params);

        // Stores bundle data from ARWeave and signals that the bundle is synced.
        await storeBundle(response.data);
        await knex('bundles')
            .where({bundle_id: bundles[i].bundle_id})
            .update({synced: true});
        console.log(`Synced bundle ${bundles[i].bundle_id}`);
    } catch(e) {
        console.log(`Bundle data not found ${bundles[i].bundle_id}`)
        await knex('bundles')
            .where({bundle_id: bundles[i].bundle_id})
            .update({synced: true});
    }
    };
};

// Stores bundle data to node. Used when pulling bundle data rather than generating it.
const storeBundle = async (_data) => {
    try {
        _data = JSON.parse(_data)

        //We now have the bundle data, which is a JSON with fields for each data moat
        //I will first check to see what moats the bundle contains that are pertinent to me

        const moats = process.env.SYNCED_DATA_MOATS.split(" ");

        //Now loop through the moats, checking if the bundle contains the moat
        for (let i = 0; i< moats.length; i++) {
            if (moats[i] in _data) {
                for (let j = 0; j < _data[moats[i]].length; j++) {
                    if ('query' in _data[moats[i]][j]) {
                        //Triggers if this is a sql query
                        await pool.query(_data[moats[i]][j].query)
                    } else if ('image' in _data[moats[i]][j]) {
                        //triggers if this is a file write
                        await storePhotos([_data[moats[i]][j].image], [_data[moats[i]][j].path])
                    } else if ('file' in _data[moats[i]][j]) {
                        await utils.write2File(_data[moats[i]][j].path, _data[moats[i]][j].file)
                    } else {
                        console.log('Unrecognized data format')
                    } 
                }
            }
        }
    } catch(e) {
        console.log(e)
    }
};

// Scans local bundles and references Harmony to return new bundles to node that haven't been imported.
const scanBundles = async (_moat, _cursor = '') => {
    const bundlesPerQuery = 100
    let bundles

    if (_cursor != '') {
        _cursor = 'after: "' + _cursor + '"'
    }

    const queryObj = {
        query:
            `query {
        transactions(
            first: ${bundlesPerQuery}
            ` +
            _cursor +
            `
            sort: HEIGHT_ASC,
            tags: [
                { name: "Application", values: ["Kwil"] }
                { name: "Version", values: ["`+process.env.BUNDLE_VERSION+`"]}
                { name: "Moat", values: ["`+process.env.SYNCED_DATA_MOATS+`"]}
            ]
        )
        {
            edges {
                cursor
                node {
                    id
                    block {
                        height
                    }
                }
            }
        }
    }`,
    }
    const queryURL = 'https://arweave.net/graphql'
    const params = {
        url: queryURL,
        method: 'post',
        timeout: 20000,
        headers: { 'Content-Type': 'application/json' },
        data: JSON.stringify(queryObj),
    }
    const response = await axios(params)
    bundles = response.data.data.transactions.edges
    console.log(bundles)
    if (bundles.length == bundlesPerQuery) {
        //If this triggers, then there are more bundles to scan
        const newBundles = await scanBundles(_moat, bundles[bundlesPerQuery-1].cursor)
        bundles = bundles.concat(newBundles)
    }
    return bundles
};


module.exports = { syncNode };
