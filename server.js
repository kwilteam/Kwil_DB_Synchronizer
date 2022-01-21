const bodyParser = require('body-parser');
require(`dotenv`).config();
const numCPUs = require('os').cpus().length;
const cluster = require('cluster');
const Express = require('express');
const cors = require('cors');
const app = Express();
const cron = require('node-cron');
const { shoveBundles } = require('./src/bundler/bundleHandlers');
const { syncNode } = require('./src/bundler/syncFuncs');
const { bundleInit } = require('./src/bundler/bundleInit');
const {pool} = require('./database/startup.js')
const handlerFunc = require('./src/handler.js')
const handler = handlerFunc.createHandler()
const start = async () => {
    
    if (cluster.isMaster) {

        // Starts up the database and logs startup to console
        console.log(`Master ${process.pid} is running`);

        // Creates Node.js worker instances on all cores
        for (let i = 0; i < numCPUs; i++) {
            cluster.fork();
        }
        app.use(bodyParser.json({ limit: '10mb' }));
        app.use(cors());

        //Request handlers right here
        //app.post('createTable', )
        app.post('/raw', handler.raw)
        app.post('/storeFile', handler.storeFile)
        app.post('/storePhoto', handler.storePhoto)
        app.get('/raw', handler.raw)
        app.use(Express.static('public', { fallthrough: false }));

        //Create a bundle table
        await pool.query(`CREATE TABLE IF NOT EXISTS bundles(
            bundle_id varchar(43) PRIMARY KEY,
            height integer NOT NULL,
            cursor_id varchar(44) NOT NULL,
            synced boolean NOT NULL,
            moat varchar(64) NOT NULL
          );`)

        // Syncs data with server.

        try {
            cron.schedule('0 0 */1 * * *', async function () {
                await syncNode();
                console.log(`Node Synced`.green);
                await shoveBundles();
            })
            } catch(e) {
                console.log('There was an error syncing'.red);
                console.log(e);
            };

        // Avoids running code on several worker threads.
        try {
            await bundleInit()
            await syncNode();
            console.log(`Node Synced`.green);
            await shoveBundles();
        } catch(e) {
            console.log('There was an error syncing or shoving'.red);
            console.log(e);
        };
        app.listen(5432, () => {
            console.log(numCPUs + ' worker threads running');
            console.log(`Server is listening on port 5432`.bold.brightGreen);
        });
    }
};


start();