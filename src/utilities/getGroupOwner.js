const knex = require('../../database/db.js');


// Returns the account's username that owns the inputted group.
const getGroupOwner = async (_group) => {
    let results = await knex('groups')
        .select('group_owner')
        .where({ group_name: _group })
    return results[0].group_owner
};


module.exports = getGroupOwner;