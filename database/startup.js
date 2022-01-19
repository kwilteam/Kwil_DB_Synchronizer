const { Client, Pool } = require('pg');
require(`dotenv`).config();
const fs = require('fs');


// Edits client credentials based on their connection (i.e. local docker image, google hosting, etc.)

 const credentials = {
        user: 'postgres',
        host: 'localhost',
        database: 'postgres',
        password: 'password',
        port: 5555,
    }
const client = new Client(credentials);
const pool = new Pool(credentials)

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err)
    process.exit(-1)
  })

// This function is used in server.js.


module.exports = { pool, client };