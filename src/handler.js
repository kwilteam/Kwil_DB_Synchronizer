const utils = require('./bundler/utils.js')
const {pool} = require('../database/startup.js')
const {storePhotos} = require('./filesystem/fileWriter.js')

const createHandler = () => {

    class Handler {

        async raw (req, res) {
            try {
                if (process.env.DATABASE_PASSWORD == req.body.password) {
                let pkeyErr = false
                let result
                try {
                    result = await pool.query(req.body.query)
                    await res.send(result.rows)
                    await res.end() //Because you cant pass objects to this for some fucking reason.  Plz make it make sense
                } catch(e) {
                    console.log('PKEY ERROR')
                    console.log(e)
                    pkeyErr = true
                    await res.status(400).send(e.toString())
                }

                //Now we add to bundle.  Statements that return a query have a _parsers field returned
                if (req.body.store == true && pkeyErr == false) {
                    const writeData = {
                        query: req.body.query,
                        timestamp: new Date
                    }
                    utils.writeToBundleCache(req, writeData)
                }
            }else {
                res.end('Invalid Password')
            }
            } catch(e) {
                console.log(e)
                res.send(e)
                res.end()
            }   
        }

        async storePhoto (req, res) {
            //req.body should contain a JSON with fields "path" and "image".
            try {
                if (process.env.DATABASE_PASSWORD == req.body.password) {

                req.body.path = 'public'+`/${req.body.moat}/`+req.body.path
                storePhotos([req.body.image], [req.body.path])
                if (req.body.store == true) {
                    await utils.writeToBundleCache(req, {
                        path: req.body.path,
                        image: req.body.image
                    })
                }
                res.end('Success')
            }else {
                res.end('Invalid Password')
            }
            } catch(e) {
                console.log(e)
                res.send(e.toString())
                res.end('There was an error')
            }
        }

        async storeFile (req, res) {
            //req.body should contain a JSON with fields "path" and "file".
            try {
                if (process.env.DATABASE_PASSWORD == req.body.password) {

                req.body.path = 'public'+`/${req.body.moat}/`+req.body.path
                await utils.write2File(req.body.path, req.body.file)
                if (req.body.store == true) {
                    await utils.writeToBundleCache(req, {
                        path: req.body.path,
                        file: req.body.file
                    })
                }
                
                res.end('Success')
            }else {
                res.end('Invalid Password')
            }
            } catch(e) {
                console.log(e)
                res.send(e.toString())
                res.end('There was an error')
            }
        }

        async transaction (req, res) {
            try {
                const queries = req.body.sql

                if (process.env.DATABASE_PASSWORD == req.body.password) {

                //We must loop through the queries, trying each.  If it fails, we rollback and return
                for (let i =0; i<queries.length; i++) {
                    try {
                        await pool.query(queries[i])
                    } catch(e) {
                        //Rollback
                        await pool.query('ROLLBACK;')
                        res.send({
                            error: `Transaction error occurred`,
                            description: e.toString()
                        })
                        console.log(`Rollback triggered`)
                        res.end()
                        return
                    }
                }

                //If it has reached here, we now check for if it should be bundled
                if (req.body.store == true) {
                    const writeData = {
                        query: req.body.sql,
                        timestamp: new Date
                    }
                    utils.writeToBundleCache(req, writeData)
                }
                res.end('Transaction Success')
            } else {
                res.end('Invalid Password')
            }

            } catch(e) {
                console.log(e)
                res.end(e.toString())
            }
        }
    }
    const retVal = new Handler()
    return retVal
}

module.exports = {createHandler}