const fs = require("fs");


// Copies files to publicCopy bundle
const publicCopyBundle = async () => {

  // Scans files in public via recursion and saves them to bundle.
  const fileScanner = async ( currentDir = "public" ) => {

    // Reads in files in directory
    let currentFile = fs.opendirSync(currentDir).readSync();

    // Loops through directory files. If it finds another directory, it reads that before continuing.
    for (let file in currentFile) {

      // Calls recursion loop if file is a directory.
      if ( currentFile.isDirectory() ) {

        fileScanner(currendDir + `/${currentFile}`);
        
      } else {
        /*
          Save file data to bundle
        */
      }

    };
  };

  // Initial call to scan files.
  fileScanner();

};

publicCopyBundle();

// module.exports = publicCopyBundle;