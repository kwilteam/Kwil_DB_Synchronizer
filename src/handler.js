const utils = require('./bundler/utils.js')
const {pool} = require('../database/startup.js')
const {storePhotos} = require('./filesystem/fileWriter.js')

const createHandler = () => {

    class handler {

        async raw (req, res) {
            try {
                const result = await pool.query(req.body.query)
                res.send(result.rows)
                res.end() //Because you cant pass objects to this for some fucking reason.  Plz make it make sense
                
                //Now we add to bundle.  Statements that return a query have a _parsers field returned
                if (req.body.store == true) {
                    const writeData = {
                        query: req.body.query,
                        timestamp: new Date
                    }
                    utils.writeToBundleCache(req, writeData)
                }
                return result.rows
            } catch(e) {
                console.log(e)
                res.send(e)
                res.end()
                return
            }   
        }

        async storePhoto (req, res) {
            //req.body should contain a JSON with fields "path" and "image".
            try {
                req.body.path = 'public/'+req.body.path
                await storePhotos([req.body.image], [req.body.path])
                if (req.body.store == true) {
                    await utils.writeToBundleCache(req, {
                        path: req.body.path,
                        image: req.body.image
                    })
                }
                res.end('Success')
            } catch(e) {
                console.log(e)
                res.send(e)
                res.end('There was an error')
            }
        }

        async storeFile (req, res) {
            //req.body should contain a JSON with fields "path" and "file".
            try {
                req.body.path = 'public/'+req.body.path
                await utils.write2File(req.body.path, req.body.file)
                if (req.body.store == true) {
                    await utils.writeToBundleCache(req, {
                        path: req.body.path,
                        file: req.body.file
                    })
                }
                
                res.end('Success')
            } catch(e) {
                console.log(e)
                res.send(e)
                res.end('There was an error')
            }
        }
    }
    const retVal = new handler()
    return retVal
}

module.exports = {createHandler}