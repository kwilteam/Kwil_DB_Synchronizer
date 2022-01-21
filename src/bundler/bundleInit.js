const fsJ = require('fs-jetpack');
const bundleInit = async () => {
    const dirs = ['./finalizedBundles', './sealedBundles']
    for (let i = 0; i<dirs.length; i++) {
        fsJ.dir(dirs[i])
    }

}

module.exports = {bundleInit}