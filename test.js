require(`dotenv`).config()
const {pool} = require('./database/startup.js')


const testF = async () => {
    //console.log(await harm.registerUsername('BABABOOEY3', modulus))
    //console.log(await harm.ifUserExistsHmy('BABABOOEY3'))
    //console.log(await harm.createMoat('DEV_3', false))
    //console.log(await harm.addAdmin('bb1324', '0xB7E2d6DABaf3B0038cFAaf09688Fa104f4409697', false))
    //console.log(await harm.ifMoatExists('bb1324'))
    //console.log(await harm.isAdmin('bb1324', '0xB7E2d6DABaf3B0038cFAaf09688Fa104f4409697'))
    //console.log(await harm.addBlock('bb1324', 'fenny1'))
    //console.log(await harm.getSender())
    //console.log(await harm.getBlocks('bb1324'))
    const yuh = await pool.query('create table test2(test varchar(5))')
    console.log(yuh.rows)
    

}
testF()