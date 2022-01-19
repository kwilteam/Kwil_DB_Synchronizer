const fs = require('fs');
const gcloud = require('../../gcloud_public/gCloudUtils.js');
const fileWriter = require('../filesystem/fileWriter.js');
require(`dotenv`).config();
const axios = require('axios');
const {v4} = require('uuid');
const path = require('path');


// Returns _dir parameter (directory) files from Google Cloud.
const readDir = async (_dir) => {
    if (process.env.NODE_ENV == 'productionG') {
        console.log('Reading dir from Google Cloud');
        const files = await gcloud.readdir(_dir+'/');
        return files;
    };
    const files = await fs.promises.readdir('./'+_dir);
    return files;
};

// Renames Google Cloud directory.
const rename = async (_oldDir, _newDir) => {
    if (process.env.NODE_ENV == 'productionG') {

        await gcloud.rename(_oldDir, _newDir);
        return;
    };
    await fs.renameSync('./'+_oldDir, './'+_newDir);
};

// Returns file string content of _file parameter in Google Cloud.
const readFile = async (_file) => {
    if (process.env.NODE_ENV == 'productionG') {
        const data = await gcloud.readFile(_file);
        return data.toString();
    };
    const content = await fileWriter.readFromFile('./'+_file);
    return content.toString();
};

// Deletes _dir parameter (directory) from Google Cloud.
const deleteFile = async (_dir) => {
    if (process.env.NODE_ENV == 'productionG') {
        await gcloud.deleteFile(_dir);
        return;
    };
    await fs.unlinkSync('./'+_dir);
};

// Moves file in Google Cloud based on inputted function parameters.
const moveFile = async (_main, _newFile, _newName = '') => {
    if (process.env.NODE_ENV == 'productionG') {
        console.log('Triggering Google File Mover');
        let f = path.basename(_main);
        await gcloud.moveFile(_main, `${_newFile}/${f}`);
        console.log('Files moved on Google Cloud');
        return;
    };
    await fileWriter.moveFile('./'+_main, './'+_newFile, _newName);
};

// Writes content in parameter (_content) to _path (file path) in Google Cloud.
const write2File = async (_path, _content) => {
    if (process.env.NODE_ENV == 'productionG') {
        console.log('Writing File to Google Cloud');
        await gcloud.write2File(_content, _path);
        console.log(`${_path} written to Google Cloud`);
        return;
    };
    await fileWriter.write2File('./'+_path, _content);
};

// Writes data to cachedBundle file.
const writeToBundleCache = async (_req) => {
    if (process.env.NODE_ENV == 'productionG') {
        await write2File(`bundles/cachedBundle${_req.params['0']}_${v4()}`, JSON.stringify(_req.body));
        return;
    };
    await fileWriter.writeToBundleCache(_req);
};


module.exports = { readDir, deleteFile, moveFile, write2File, writeToBundleCache, readFile, rename };
