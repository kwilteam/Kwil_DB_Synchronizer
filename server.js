const bodyParser = require('body-parser');
require(`dotenv`).config();
const numCPUs = require('os').cpus().length;
const cluster = require('cluster');
const Express = require('express');
const app = Express();
const cron = require('node-cron');
const { shoveBundles } = require('./src/bundler/bundleHandlers');
const { syncNode } = require('./src/bundler/syncFuncs');
const { bundleInit } = require('./src/bundler/bundleInit');
const {pool} = require('./database/startup.js')
const handlerFunc = require('./src/handler.js')
const handler = handlerFunc.createHandler()
const {WebSocketServer} = require('ws')
const utils = require('./src/bundler/utils.js')
let server = require('http').createServer();




const start = async () => {
    
    if (cluster.isMaster) {

        // Starts up the database and logs startup to console
        console.log(`Master ${process.pid} is running`);

        // Creates Node.js worker instances on all cores
        for (let i = 0; i < numCPUs; i++) {
            cluster.fork();
        }
        app.use(bodyParser.json({ limit: '10mb' }));

        //Request handlers right here
        //app.post('createTable', )
        app.post('/raw', handler.raw)
        app.post('/storeFile', handler.storeFile)
        app.post('/storePhoto', handler.storePhoto)
        app.post(`/transaction`, handler.transaction)
        app.get('/raw', handler.raw)
        //app.use(Express.static('public', { fallthrough: false }));

        //Create a bundle table
        await pool.query(`CREATE TABLE IF NOT EXISTS bundles(
            bundle_id varchar(43) PRIMARY KEY,
            height integer NOT NULL,
            cursor_id varchar(44) NOT NULL,
            synced boolean NOT NULL,
            moat varchar(64) NOT NULL
          );`)


        //Init bundles
        try {
            await bundleInit()
        } catch(e) {
            console.log(e)
        }

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

        //Making a websocket and http server
        let wss = new WebSocketServer({
            server: server,
            perMessageDeflate: false
          })
        server.on('request', app);
        server.listen(process.env.NODE_PORT, function () {
            console.log(`Server is running on port ${process.env.NODE_PORT}`)
        })

        wss.on('connection', function connection(ws) {
            ws.on('message', async function message(data) {
                try {
                    const req = JSON.parse(data.toString())
                    console.log(req)
                    if (process.env.DATABASE_PASSWORD == req.data.password) {
                        let pkeyErr = false
                        try {
                            const result = await pool.query(req.data.query)
                            this.send(JSON.stringify(result.rows))
                        } catch(e) {
                            this.send(e.toString())
                            console.log(e)
                            pkeyErr = true
                        }
                        if (req.data.store == true && pkeyErr == false) {
                            const writeData = {
                                query: req.data.query,
                                timestamp: new Date
                            }
                            utils.writeToBundleCache(req, writeData)
                        }

                    } else {
                        this.send(`Incorrect password`)
                    }
                }
                catch(e) {
                    //Will try/catch again to try to send the error.  If the error is the client then it will give up
                    try {
                        this.send(e.toString())
                    } catch(e) {
                        console.log(e)
                    }
                    }
            });
            
        });
    }
};


start();