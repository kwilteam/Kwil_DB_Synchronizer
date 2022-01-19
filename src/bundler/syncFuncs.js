require(`dotenv`).config();
const knex = require('../../database/db');
const axios = require('axios');
const handlerFile = require('../handler');
const { wait } = require('./bundleHandlers');
//const harmony = require('../../harmony/harmonyUtils');


// Syncs node data with bundles referenced on Harmony network.
const syncNode = async () => {
    if (process.env.SYNC == false.toString()) {return}
    
    const moats = process.env.SYNCED_DATA_MOATS.split(" ");

    // Loops through all data moats, and scans Harmony network for new Kwil bundles.
    // Stores bundle metadata to the local node DB.
    for (let i = 0; i<moats.length; i++) {
        const bundleMetaData = await scanBundles(moats[i]);

        // Loops through and stores new Kwil bundle metadata to node database.
        for (let j = 0; j<bundleMetaData.length; j++) {
            try {
                await knex('bundles').insert({
                    bundle_id: bundleMetaData[j].hash,
                    height: bundleMetaData[j].height,
                    synced: false,
                    moat: moats[i]
                });
            } catch(e) {
                console.log(e);
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
        const params = {
            url: `${process.env.ARWEAVE_NODES}/${bundles[i].bundle_id}`,
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
    };
};

// Stores bundle data to node. Used when pulling bundle data rather than generating it.
const storeBundle = async (_data) => {
    _data = JSON.parse(_data)
    async function defUnbundler(bData, res, _sigFunc, _dbFunc) {
        // Very similar to def handler only utilizes sig and db functions, doesn't worry about responses.
        if (await _sigFunc(bData)) {
            try {
                await _dbFunc(bData);
            } catch(e) {
                console.log('Record already exists');
            };
        };
    };

    // We will have to leave response empty in order to match the handlers inputs.
    const bundleHander = handlerFile.createHandler(defUnbundler);

    /*
        When data is fed, feed the raw data and then an empty string as the "response".
    */
    const fields = Object.keys(_data);

    // Removes createAccount from fields since this gets unbundled separately.
    const index = fields.indexOf('createAccount');
    fields.splice(index, 1);

    // Unbundles account to add to node dataset.
    if ( typeof _data.createAccount != 'undefined' ) {
        for (let i = 0; i< _data.createAccount.length; i++) {
            try {
                await bundleHander.createAccount(_data.createAccount[i], '');
            } catch(e) {};
            console.log(`Unbundled user ${_data.createAccount[i].username}`);
        };
    };


    await wait(2000);


    // Iterates through and stores all new bundle data.
    for ( let i = 0; i<fields.length; i++ ) {
        const handlerFunc = bundleHander[fields[i]];
        for ( let j=0; j<_data[fields[i]].length; j++ ) {
            try {
                await handlerFunc(_data[fields[i]][j], '');
            } catch(e) {};
        };
    };
};

// Scans local bundles and references Harmony to return new bundles to node that haven't been imported.
const scanBundles = async (_moat) => {
    const lastScannedBundle = await knex('bundles').select('height').where({moat: _moat}).orderBy('height', 'desc').limit(1);
    let height;
    if (lastScannedBundle.length == 0) {
        height = 0
    } else {
        // I add 1 because if it pulled that height then it is aware of that height
        height = lastScannedBundle[0].height + 1;
    }
    /*
        Should probably set timeout here
    */
    //const newBundles = await harmony.getBlocks(_moat, height);
    //return newBundles;
    return []
};


module.exports = { syncNode };
