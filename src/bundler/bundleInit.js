const fs = require('fs')

const bundleInit = async () => {
    if (!fs.existsSync('./bundles')){
        fs.mkdirSync('./bundles');
    }
    const dirs = ['./bundles/cachedBundle', './bundles/finalizedBundles', './bundles/pendingBundles', './bundles/sealedBundles']
    for (let i = 0; i<dirs.length; i++) {
        if (!fs.existsSync(dirs[i])){
            fs.mkdirSync(dirs[i]);
        }
    }

}

module.exports = {bundleInit}