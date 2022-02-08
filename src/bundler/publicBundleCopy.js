const fs = require("fs");
const { connected } = require("process");


// Copies files to publicCopy bundle
const publicCopyBundle = async () => {
  // Saves files from public to "copyTest"
  let publicDir = fs.opendirSync("public");

  // Loops through files in public and saves them to bundle.
  const fileScanner = async () => {
    let filesLeft = true;
    while (filesLeft) {
      // Read a file as fs.Dirent object
      let currentFile = publicDir.readSync();
      if ( currentFile.isDirectory ) {
        let subDir = currentFile.readSync()
        fileScanner();
      };
      
      // If readSync() does not return null
      // print its filename
      if (currentFile != null) {
        console.log("Name:", currentFile.name);
        console.log("Directory:", currentFile.isDirectory());
      }
      // If the readSync() returns null
      // stop the loop
      else filesLeft = false;
    };
  }
};

publicCopyBundle();

// module.exports = publicCopyBundle;