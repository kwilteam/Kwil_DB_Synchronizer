const gc = require('../cloud_config/gcloud_config.js');
const { hashPath } = require('../src/filesystem/hashPath.js');


// Uploads image jpeg to database in google cloud.
const uploadImage = async (_file, _hash) => {
  try {

    console.time('photo_write');

    const myBucket = gc.bucket('kwilfiles');
    const file = myBucket.file(`images/${hashPath(_hash)}${_hash}.jpg`);
    const contents = new Buffer.from(_file, 'base64');

    await file.save(contents);
    console.timeEnd('photo_write');
    console.log(`Uploaded Image ${_hash}`);
    return;

  } catch(e) {
    console.log(e);
  };
};

// Uploads full file to database in google cloud.
const uploadFile = async (_file, _hash) => {
  try {
    console.time('file_write')
    const myBucket = gc.bucket('kwilfiles');
    
    const file = myBucket.file(_hash);
    const contents = new Buffer.from(_file);

    await file.save(contents);
    console.timeEnd('file_write');
    console.log(`Uploaded File ${_hash}`);
    return;
  } catch(e) {
    console.log(e);
  }
};


module.exports = { uploadImage, uploadFile };
