const fs = require("fs");


// Copies files to publicCopy bundle
const publicCopyBundle = async () => {

  // Scans files in public via recursion and saves them to bundle.
  const fileScanner = async ( currentDir = "public" ) => {

    // Reads in files in directory
    let openedDir = fs.opendirSync(currentDir);
    let filesLeft = true;

    // Loops through directory files. If it finds another directory, it reads that before continuing.
    while ( filesLeft ) {

      // Creates Dirent object to read current iteration in directory.
      let fileDirent = openedDir.readSync();

      // Checks whether fileDirent is null before running any functions on it.
      if ( fileDirent == null ) {
        // Sets filesLeft to false to stop cycling through directory.
        filesLeft = false;
      } else if ( fileDirent.isDirectory() ) {
        // Calls recursion loop if file is a directory.
        fileScanner(currentDir + `/${fileDirent.name}`);
      } else if ( fileDirent != null ) {
        console.log(fileDirent.name);
        /*
          Save file data to bundle
        */
      };
    };
  };

  // Initial call to scan files.
  fileScanner();

};

publicCopyBundle();

// module.exports = publicCopyBundle;