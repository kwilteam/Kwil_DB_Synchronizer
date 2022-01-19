const {pool} = require('../database/startup.js')

const createHandler = () => {

    class handler {

        async raw (req, res) {
            try {
                const result = await pool.query(req.body.query)
                res.send(result)
                res.end() //Because you cant pass objects to this for some fucking reason.  Plz make it make sense
                return result
            } catch(e) {
                console.log(e)
                res.send(e)
                res.end()
                return
            }
            
        }
    }

    const retVal = new handler()
    return retVal
}

module.exports = {createHandler}