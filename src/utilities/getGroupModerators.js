const knex = require('../../database/db.js');


// Returns a group's moderator account usernames.
const getGroupModerators = async (_group) => {
    let results = await knex('groups')
        .select('moderators')
        .where({ group_name: _group });
    return results[0].moderators;
};


module.exports = getGroupModerators;
