/*
    This file is the same as handler, except it accepts parsed JSON
    as the singular input instead of request and response.
    It also doesn't write to the cached bundle
*/
const {
    checkPostSig,
    checkSignature,
    checkGroupSignator,
} = require('./utilities/signatures.js');
const knex = require('../database/db.js');
const writer = require('./filesystem/fileWriter.js');
const getGroupMembers = require('./utilities/getGroupModerators.js');


// Unbundler allows for data addition to the local node when the server requires updated data.
class unbundler {

    async createAccount(u) {
        try {
            await knex('users').insert({
                username: u.username,
                modulus: u.modulus,
            });
            if (
                (await checkSignature(
                    JSON.stringify({
                        username: u.username,
                        name: u.name,
                        bio: u.bio,
                        photoHash: u.photoHash,
                    }),
                    u.signature,
                    u.modulus
                )) &&
                (await checkSignature(
                    JSON.stringify({
                        username: u.username,
                        modulus: u.modulus,
                        email: u.email,
                        salt: u.salt,
                        login: u.login,
                    }),
                    u.creationSignature,
                    u.modulus
                ))
            ) {
                await knex('user_data').insert({
                    username: u.username,
                    display_name: u.name,
                    bio: u.bio,
                    pfp_hash: u.pfpHash,
                    rsa_signature: u.signature,
                });
                await knex('user_accounts').insert({
                    username: u.username,
                    email: u.email,
                    salt: u.salt,
                    login_ciphertext: u.login,
                    rsa_signature: u.creationSignature,
                });
                console.log(`New account ${u.username} unbundled`);
            } else {
                console.log(
                    `There was a signature error for account ${u.username}`
                );
            };
        } catch (e) {
            console.log(
                `There was an error.  Username ${u.username} may already exist.`
            );
        };
    };

    async createPost(p) {
        if (await checkPostSig(p)) {
            try {
                await knex('posts').insert({
                    post_id: p.data.id,
                    post_title: p.data.title,
                    post_text: p.data.text,
                    post_time: p.data.timestamp,
                    post_type: p.data.type,
                    username: p.data.username,
                    group_name: p.data.group,
                    photo_hash: p.data.photoHash,
                    rsa_signature: p.signature,
                });
                if (p.photo.length > 0) {
                    writer.writePhoto(p);
                };
                console.log(`Posted ID ${p.data.id} unbundled`);
            } catch (e) {
                console.log(e);
                console.log(`Error unbundling post ID ${p.data.id}`);
            }
        } else {
            console.log(`Posted ID ${p.data.id} invalid signature`);
        };
    };

    async createComment(p) {
        if (await checkPostSig(p)) {
            if (
                p.referenceType != 'thought' ||
                p.referenceType != 'thinkpiece' ||
                p.referenceType != 'comment'
            ) {
                const tableName = p.referenceType + '_comments';
                await knex(tableName).insert({
                    post_id: p.data.id,
                    post_text: p.data.text,
                    post_time: p.data.timestamp,
                    username: p.data.username,
                    reference_id: p.data.referenceID,
                    rsa_signature: p.signature,
                });
                console.log(`Comment ID ${p.data.id} unbundled`);
            } else {
                console.log(
                    `Comment ID ${p.data.id} has an incorrect reference type, and is not being unbundled`
                );
            };
        } else {
            console.log(`Comment ID ${p.data.id} has an invalid signature`);
        };
    };

    async changeAccountData(a) {
        if ( await checkPostSig(a) ) {
            try {
                let updateObj = {};
                for (let i = 0; i < a.changed.length; i++) {
                    if (a.changed[i] == 'pfp_hash') {
                        updateObj['pfp_hash'] = a.data.photoHash[0];
                    };
                    if (a.changed[i] == 'display_name') {
                        updateObj['display_name'] = a.data.name;
                    };
                    if (a.changed[i] == 'bio') {
                        updateObj['bio'] = a.data.bio;
                    };
                };
                if (Object.keys(updateObj).length != 0) {
                    await knex('user_data')
                        .where({
                            username: a.data.username.toLowerCase(),
                        })
                        .update(updateObj);
                    if (a.photo && a.changed.includes('pfp_hash')) {
                        writer.writePhoto(a);
                    };
                };
                console.log(`Account ${a.data.username} changed`);
            } catch (e) {
                console.log(e);
                console.log(
                    `There was an error unbundling changes for ${a.data.username}`
                );
            };
        } else {
            console.log(
                `Account ${a.data.username} change has an invalid signature`
            );
        };
    };

    async follow(f) {

        if (await checkPostSig(f)) {
            // Checks whether there is an existing entry for this exact follower relationship.
            const follower = f.data.username.toLowerCase();
            const followee = f.data.followee.toLowerCase();
            const results = await knex('followers')
                .select('followee')
                .where({ follower: follower, followee: followee });
            let relationExists = false;

            if (results.length > 0) {
                relationExists = true;
            };

            if (f.data.follow == true && relationExists == false) {
                try {
                    await knex('followers').insert({
                        follower: follower,
                        followee: followee,
                        post_time: new Date(f.data.timestamp),
                    });
                    console.log(
                        `Follow relationship: ${follower} => ${followee} unbundled`
                    );
                } catch (e) {
                    console.log(e);
                    console.log(
                        `There was an error with: Follow relationship: ${follower} => ${followee}`
                    );
                };
            } else if ( f.data.follow == false && relationExists == true ) {
                try {
                    await knex('followers')
                        .where({
                            follower: follower,
                            followee: followee,
                        })
                        .del();
                    console.log(
                        `Follow relationship: ${follower} =x> ${followee} unbundled`
                    );
                } catch (e) {
                    console.log(e);
                    console.log(
                        `There was an error with: Follow relationship: ${follower} =x> ${followee}`
                    );
                };
            } else if (relationExists) {
                console.log(`${follower} already follows ${followee}`);
            } else if (!relationExists) {
                console.log(`${follower} doesn't follow ${followee}`);
            };

        } else {
            console.log(
                `Follow relationship: ${follower} => ${followee} invalid signature`
            );
        };
    };

    async createGroup(g) {
        if (await checkPostSig(g)) {
            try {
                const _username = g.data.username.toLowerCase();
                const _group = g.data.groupName.toUpperCase();
                await knex('groups').insert({
                    group_name: _group,
                    group_owner: _username,
                    public: g.data.public,
                    group_description: g.data.description,
                    tags: g.data.tags,
                    links: g.data.links,
                    moderators: g.data.moderators,
                    photo_hash: g.data.photoHash,
                    color: g.data.color,
                    rsa_signature: g.signature,
                    signator: _username,
                });
                if (g.photo != '') {
                    writer.writePhoto(g);
                }
                console.log(`Group ${_group} unbundled`);
            } catch (e) {
                console.log(e);
                console.log(`There was an error unbundling group ${_group}`);
            };
        } else {
            console.log(`Group ${_group} has an invalid signature`);
        };
    };

    async editGroup(g) {
        if (await checkGroupSignator(g)) {
            try {
                if (!g.changed.hasOwnProperty('rsa_signature')) {
                    g.changed.rsa_signature = g.signator.signature
                };
                await knex('groups')
                    .where({ group_name: g.data.group_name })
                    .update(g.changed);
                if (g.changed.photo_hash) {
                    writer.writePhoto(g);
                };
                console.log(`Group ${_group} changes unbundled`);
            } catch (e) {
                console.log(e);
                console.log(`Error unbundling changes from ${_group}`);
            };
        } else {
            console.log(`Group ${_group} changes has an invalid signature`);
        };
    };

    async addMember(m) {
        if (await checkGroupSignator(m)) {
            try {
                const newMember = m.data.newMember.toLowerCase();
                const memberList = await getGroupMembers(m.data.group_name);
                if (m.data.added == true) {
                    if (!memberList.includes(newMember)) {
                        memberList.push(newMember);
                        await knex('groups')
                            .where({
                                group_name: m.data.group_name,
                            })
                            .update({ moderators: memberList });
                        console.log(`Group moderator ${newMember} unbundled`);
                    } else {
                        console.log(
                            `${newMember} is already a moderator in group ${m.data.group_name}`
                        );
                    };
                } else if (m.data.added == false) {
                    if (memberList.includes(newMember)) {
                        const removeIndex = memberList.findIndex(
                            (member) => member == newMember
                        );
                        memberList.splice(removeIndex, 1);
                        await knex('groups')
                            .where({
                                group_name: m.data.group_name,
                            })
                            .update({ moderators: memberList });
                        console.log(
                            `Group moderator removal of ${newMember} unbundled`
                        );
                    } else {
                        console.log(
                            `${newMember} is already not a moderator in group ${m.data.group_name}`
                        );
                    };
                };
            } catch (e) {
                console.log(e);
                console.log(`Error unbundling group member ${newMember}`);
            };
        } else {
            console.log(`Group moderator ${newMember} invalid signature`);
        };
    };

    async followGroup(f) {
        if ( await checkPostSig(f) ) {
            try {
                const group = f.data.group.toUpperCase();
                const username = f.data.username.toLowerCase();
                if (f.data.follow == true) {
                    const queryRes = await knex('group_followers')
                        .select('group_name')
                        .where({
                            group_name: group,
                            follower: username,
                        });
                    if (queryRes.length == 0) {
                        await knex('group_followers').insert({
                            follower: username,
                            group_name: group,
                            post_time: new Date(f.data.timestamp),
                        });
                        console.log(
                            `User ${username} now follows group ${group}`
                        );
                    } else {
                        console.log(
                            `User ${f.data.username} already follows group ${group}`
                        );
                    };
                } else if (f.data.follow == false) {
                    await knex('group_followers')
                        .where({
                            follower: f.data.username,
                            group_name: group,
                        })
                        .del();
                    console.log(
                        `User ${username} no longer follows group ${group}`
                    );
                };
            } catch (e) {
                console.log(e);
                console.log(
                    `Error having user ${username} follow group ${group}`
                );
            };
        } else {
            console.log(
                `Invalid signature for ${username} following group ${group}`
            );
        };
    };
};


module.exports = new unbundler();
