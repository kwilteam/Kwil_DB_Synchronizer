const knex = require('../database/db.js');

// Queries Kwil server based on request, response, and the inputted query function.
async function defGetter(req, res, _queryFunc) {
    try {
        const result = await _queryFunc(req);
        res.send(result);
    } catch(e) {
        res.send('There was an error');
        console.log(e);
    }
    res.end()
};

class Getter {

    //Getter shit here
};


module.exports = new Getter;
