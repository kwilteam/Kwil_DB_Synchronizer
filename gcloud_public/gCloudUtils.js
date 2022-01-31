const helper = require('./helper.js');


// The ID of the bucket the original file is in.
const srcBucketName = 'kwilfiles';

// Creates a client.
const storage = require('../cloud_config/gcloud_config.js');

// Copies a file from one inputted file path to another via storage buckets.
const copyFile = async (_mainFilePath, _destFilePath) => {
    await storage
    .bucket(srcBucketName)
    .file(_mainFilePath)
    .copy(storage.bucket(srcBucketName).file(_destFilePath));
    console.log(
        `gs://${srcBucketName}/${_mainFilePath} copied to gs://${srcBucketName}/${_destFilePath}`
    );
};

/*
    moveFile can only be used in the same bucket
*/
// Moves file from one place to another.
const moveFile = async (_mainFile, _destFile) => {
    await storage.bucket(srcBucketName).file(_mainFile).move(_destFile);
};

// Uploads file to current bucket via inputted file path and name.
const write2File = async (_file, _name) => {
    await helper.uploadFile(_file, _name);
};

// Reads inputted file from current bucket.
const readFile = async (_file) => {
    const data = await storage.bucket(srcBucketName).file(_file).download();
    return data;
};

// Deletes inputted file paramater from storage bucket.
const deleteFile = async (_file) => {
    await storage.bucket(srcBucketName).file(_file).delete();
};

// Renames directory in bucket via inputted paramaters.
const rename = async (_oldDir, _newDir) => {
    await storage.bucket(srcBucketName).file(_oldDir).rename(_newDir);
};

// Reads in and returns files from bucket based on inputted directory parameter.
const readdir = async (_dir) => {
    const options = {
        prefix: _dir,
        delimiter: '/',
        autoPaginate: false
      };
    let files = await storage.bucket(srcBucketName).getFiles(options);
    // We have to cycle through and push names but not arrays since google keeps returning an array in the array.
    const finalFiles = [];
    files[0].forEach(file => {
        if (file.id) {
            let name = file.name;
            name = name.split("/");
            finalFiles.push(name[name.length-1]);
        };
    });
    return finalFiles;
};

const readFolders = async (_dir) => {
    const options = {
        prefix: _dir,
        delimiter: '/',
        autoPaginate: false
      };
    let [files, nextQuery, apiResponse] = await storage.bucket(srcBucketName).getFiles(options);

    //Now we need to iterate through apiResponse.prefixes, split by by /, and return the object in 1 position
    const finalFiles = [];
    if (typeof apiResponse.prefixes != 'undefined') {

    apiResponse.prefixes.forEach(pref => {
        let paths = pref.split('/')
        finalFiles.push(paths[1])
    })
}
    return finalFiles
}


module.exports = {copyFile, moveFile, write2File, readFile, deleteFile, readdir, rename, readFolders}