const bodyParser = require('body-parser');
require(`dotenv`).config();
const numCPUs = require('os').cpus().length;
const cluster = require('cluster');
const Express = require('express');
const cors = require('cors');
const app = Express();
const cron = require('node-cron');
const utils = require('./src/bundler/utils');
const { shoveBundles } = require('./src/bundler/bundleHandlers');
const { syncNode } = require('./src/bundler/syncFuncs');
const { bundleInit } = require('./src/bundler/bundleInit');
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

        // This is used to bundle
        /*app.post('*', async function (req, res, next) {
            await utils.writeToBundleCache(req);
            next();
        });*/


        //Request handlers right here
        //app.post('createTable', )
        app.post('/raw', handler.raw)
        app.use(Express.static('public', { fallthrough: false }));

        await bundleInit()
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