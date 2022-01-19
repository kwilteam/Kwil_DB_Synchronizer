const feeKey = require('../../key.js').key;
require(`dotenv`).config();
const {v4} = require('uuid');
const knex = require('../../database/db.js');
const Arweave = require('arweave');
const colors = require('colors');
const utils = require('./utils.js');
//const harmony = require('../../harmony/harmonyUtils.js');
const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https',
    timeout: 20000,
});


// Bundles a post to the cachedBundle.
const bundlePost = async (_req) => {
    await utils.writeToBundleCache(_req)
}

// Moves all files from bundles/cahcedBundle to bundles/sealedBundles.
const sealBundle = async () => {
    const files = await utils.readDir(`bundles/cachedBundle`);
    for (let i = 0; i<files.length; i++) {
        await utils.moveFile(`bundles/cachedBundle/${files[i]}`, `bundles/sealedBundles`);
    };
};

// Takes files from sealed bundles and puts them into a single file in finalized bundles.
const finalizeBundle = async () => {
    let finalBundle = {};
    const files = await utils.readDir(`bundles/sealedBundles`);

    // Splits bundles up into sub-bundle types (like post, createAccount, etc.) and seals their data accordingly.
    for (let i = 0; i<files.length;i++) {
        let subBundleType = files[i].split("_");
        subBundleType = subBundleType[0];
        if (!finalBundle[subBundleType]) {
            finalBundle[subBundleType] = [];
        };
        let fileData = await utils.readFile(`bundles/sealedBundles/${files[i]}`);
        if (fileData.length > 0) {
            finalBundle[subBundleType].push(JSON.parse(fileData));
        } else {
            console.log(`${files[i]} contained no data.  Deleting.`);
            await utils.deleteFile(`bundles/sealedBundles/${files[i]}`);
        };
    };
    finalBundle = JSON.stringify(finalBundle);
    
    // Checks whether bundles have data adds those who do to finalizedBundles.
    if (finalBundle.length > 2) {
        await utils.write2File(`bundles/finalizedBundles/${v4()}`, JSON.stringify(finalBundle));
    };
    // Deletes remaining bundles in sealedBundles.
    // This happens after finalizing bundles in case the server crashes while finalizing.
    for (let i = 0; i<files.length; i++) {
        try {
            /*
                This will throw an error despite working because *dark magic*.
            */
            await utils.deleteFile(`bundles/sealedBundles/${files[i]}`);
        } catch(e) {
            console.log('Error deleting File');
        };
    };
};

// Submits finalized bundles to ARWeave.
const submitBundles = async () => {
    const files = await utils.readDir(`bundles/finalizedBundles`);

    // Loops through all finalized bundles and sends them to Arweave.
    // Pending bundles are moved to pendingBundles folder in wrapper function.
    for (let i=0; i<files.length; i++) {
        await sendBundleToArweave(`bundles/finalizedBundles/${files[i]}`, false);
    };
};

// Scans pending bundles to check their upload status and updates their existence accordingly.
const scanPendingBundles = async () => {
    const files = await utils.readDir(`bundles/pendingBundles`);
    for (let i = 0; i<files.length; i++) {
        const status = await arweave.transactions.getStatus(files[i]);
        
        // Executes pending bundle management according ARWeave bundle transaction status.
        if (status.status == 202) { // Outputs that bundle is still pending to console.
            console.log(`${files[i]} is still pending`);
            console.log(status);
        } else if (status.status == 200) { // Outputs that bundle has been mined to console and adds transaction data to Harmony network.
            console.log(`${files[i]} has been mined.  Deleting from pending pool.  Status: ${status.status}`);
            await utils.deleteFile(`bundles/pendingBundles/${files[i]}`);
            //await harmony.addBlock(process.env.DATA_MOAT, files[i]);
        } else if (status.status == 404) { // Resubmits bundle to ARWeave network if transaction fails to get mined.
            console.log(`${files[i]} was pending and expired.  Resumbitting...`);
            const txid = await sendBundleToArweave(`bundles/pendingBundles/${files[i]}`);
                // Adds bundle to registry.
                await knex('bundles').insert({
                    bundle_id: txid,
                    synced: true,
                    height: 1, // Since this node is submitting the submission height is 1.
                    moat: process.env.DATA_MOAT
                });
        } else {
            console.log(`There was an error.  ARWeave returned an unexpected status code.`);
            console.log(status);
        };
    };
};


// Submits bundle from _path parameter to ARWeave.
// _pending is set to true by default, however if false, it will move the bundle to pending and delete previous path.
const sendBundleToArweave = async (_path, _pending=true) => {
    // Reads data from bundles and creates corresponding ARWeave transaction.
    let readData = await utils.readFile(_path);
    let arweaveTransaction = await arweave.createTransaction(
        { data: readData },
        feeKey
    );

    // Adds ARWeave transaction tags. Necessary tags are application, version, and data moat.
    arweaveTransaction.addTag('Application', 'Kwil');
    arweaveTransaction.addTag('Version', process.env.BUNDLE_VERSION);
    arweaveTransaction.addTag('Moat', process.env.DATA_MOAT);
    
    // Signs generated ARWeave transaction.
    await arweave.transactions.sign(arweaveTransaction, feeKey);
    
    // Gets ARWeave uploader for chunk uploading and uploads data. Logs success.
    let uploader = await arweave.transactions.getUploader(
        arweaveTransaction
    );
    while (!uploader.isComplete) {
        await uploader.uploadChunk();
        console.log(
            `${uploader.pctComplete}% complete, ${uploader.uploadedChunks}/${uploader.totalChunks}`
        );
    };
    console.log(`Bundle submitted to Arweave.  Bundle path: ${_path}.  Arweave TXID: ${arweaveTransaction.id}`);


    if (_pending == false) { // Moves file from wherever it was to pending.
        console.log(`Bundle ${_path} being set to pending.`);
        await utils.moveFile(_path, `bundles/pendingBundles`, arweaveTransaction.id);

    } else { // Renames new file for resubmission if it has already been set to pending and failed to get mined.
        console.log(`Bundle ${_path} already set to pending.  It has been resubmitted.`);
        await utils.rename(_path, `bundles/pendingBundles/${arweaveTransaction.id}`);
    }
    return {
        id: arweaveTransaction.id
    };
};


const wait = (timeToDelay = 1000) => new Promise((resolve) => setTimeout(resolve, timeToDelay));


// Executes bundle functions in the correct order for bundle rearrangement/submission.
const shoveBundles = async () => {
    if (process.env.SHOVE == false.toString()) {return}
    await sealBundle();
    console.log('Bundle Sealed'.green);
    await wait();
    await finalizeBundle();
    console.log(`Bundle Finalized`.green);
    await wait();
    await scanPendingBundles();
    console.log(`Pending Bundles Scanned`.green);
    await wait();
    await submitBundles();
    console.log(`New Bundles Submitted`.green);
};


module.exports = { bundlePost, sealBundle, finalizeBundle, submitBundles, scanPendingBundles, shoveBundles, wait };
