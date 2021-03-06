const fsG = require('graceful-fs');
const fs = require('fs');
const { hashPath } = require('./hashPath');
const fsJ = require('fs-jetpack');
const path = require('path');
const { uploadImage, uploadFile } = require('../../gcloud_public/helper');
require(`dotenv`).config();
const {v4} = require('uuid');


// Writes file content to desired file path parameter.
const write2File = (_path, _content) => {
    //Will first split by forward slash.  Then use all but last in fsJ.dir
    const directs = _path.split('/')
    let subPath = ''
    if (directs.length > 0) {
        for (let i = 0; i< directs.length-1; i++) {
            subPath = subPath + directs[i] + '/'
        }
        console.log(subPath)
        fsJ.dir(subPath)
    }

    // Feeds in content as a buffer from a stringified JSON.
    let fileStream = fsG.createWriteStream(`${_path}`, { flags: 'w' });
    fileStream.write(_content);
    fileStream.close();
    console.log(`Wrote file ${_path} to local filesystem`);
};

// Reads in file from desired file path.
const readFromFile = async (_path) => {
    // This will throw an error if path D.N.E. and returns the desired file otherwise.
    if (fs.existsSync(_path)) {
        return fs.readFileSync(_path);
    } else {
        throw new Error(`Path "${_path}" does not exist`);
    };
};

// Stores inputted photo array to Google Cloud bucket based on corresponding hash.
const storePhotosGoogle = async (_photos, _hashes) => {
    if (_photos.length != _hashes.length) {
        // This stops the code if the hash and photo arrays have different lengths.
        throw new Error('Number of photos and hashed is not the same');
    };
    for (let i=0; i<_hashes.length; i++) {
        uploadImage(_photos[i], _hashes[i]);
        console.log(`Photo uploaded to Google Bucket: ${_hashes[i]}`);
    }
    return;
};

// General function for node photo storage.
const storePhotos = (_photos, _hashes) => {
    try {
        // Returns nothing if no photos are inputted into function.
        if (_photos[0] == null) {
            return;
        };

        // Stores photos with Google.
        if (process.env.NODE_ENV == 'productionG' || process.env.IS_GOOG == true) {
            storePhotosGoogle(_photos, _hashes);
            return;
        };

        // Managaes local node photo storage.
        if (_photos.length != _hashes.length) {
            // Throws error if photo and hash arrays don't correspond length-wise.
            throw new Error('Number of photos and hashed is not the same');
        };
        if (Array.isArray(_photos)) {
            // Writes array of inputted photos.
            for (let i = 0; i < _hashes.length; i++) {
                /*
                    Note: In a world where computing capacity doesn't matter, it would be ideal to hash the photo server-side.
                */
                // Finds photo hash and stores its corresponding directory path into photoPath.
                const photoHash = _hashes[i];

                // Creates photo hashpath if it doesn't already exist.
                const subDirects = _hashes[i].split('/')
                let finPath = ''
                if (subDirects.length>1) {
                    for (let j=0; j<subDirects.length-1; j++) {
                        finPath = finPath + subDirects[j] + '/'
                    }
                } else {
                    finPath = subDirects
                }

                fsJ.dir(finPath)
                // Checks whether the photo is already saved on the node and saves it if it's not.
                if (!fs.existsSync(`${finPath}.jpg`)){
                    fs.writeFile(
                        `${_hashes[i]}.jpg`,
                        _photos[i],
                        { encoding: 'base64' },
                        function(err) {
                            console.log(err);
                        }
                    );
                } else {
                    // Logs that photo already exists on the node if a redundant save request is submitted.
                    console.log(`Photo already exists: ${photoHash}`);
                };
            };
        };
    } catch(e) {
        console.log(e);
    };
};

// Stores settings with Google.
const storeGoogleSettings = async (_settings, _settingsHash) => {
    uploadFile(_settings, _settingsHash);
    console.log(`Wrote settings to Google ${_settingsHash}`);
};

// Writes settings to local node.
const writeSettings = async (_settings, _settingsHash) => {
    if (process.env.NODE_ENV == 'productionG' || process.env.IS_GOOG == true) {
        // Stores setings parameters with Google.
        storeGoogleSettings(_settings, _settingsHash);
        return;
    } else {
        // Creates file path where settings are stored and stores inputted settings parameters.
        const path = `./public/settings/${hashPath(_settingsHash)}/`;
        fsJ.dir(path);
        await write2File(path+_settingsHash, _settings);
    };
};

/*
    Requires fs and path modules.
*/
// Moves file from one directory path to another on the node.
const moveFile = async (file, dir2, _newName = '') => {
    console.log(`Copying file ${file} to ${dir2}`)
    fsJ.dir(dir2)

    // Gets file name and adds it to dir2, or uses new one.
    let f;
    if (_newName == '') {
        f = path.basename(file);
    } else {
        f = _newName;
    };

    var source = fs.createReadStream(file);
    var dest = fs.createWriteStream(path.resolve(dir2, f));

    source.pipe(dest);
    source.on('end', async function () {
        console.log(`File ${file} successfully moved to ${dir2}`);
        console.log(`Deleting file ${file}`);
        try {
            await fs.unlinkSync(file);
        } catch(e) {};

    });
    source.on('error', function (err) {
        console.log(err);
        console.log('There was an error copying ' + file);
    });
};

// Writes to persistant fs storage based on: request type, and some unique identifier (unique identifier is unimportant, just must be unique).
const writeToBundleCache = async (_data, _req) => {
    // Writes by endpoint and uuid.
    fsJ.dir(`./bundles/${_req.body.moat}/cachedBundle`)
    await write2File(`./bundles/${_req.body.moat}/cachedBundle/${_req.originalUrl}_${v4()}`, JSON.stringify(_data));
};


module.exports = { write2File, readFromFile, moveFile, storePhotos, writeSettings, writeToBundleCache };
