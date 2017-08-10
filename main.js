import fs from 'fs';
import readline from 'readline';
import {promisify} from 'util';

import authorize from './authorize';
import makeGDriveFolderBackup from './makeGDriveFolderBackup';

const readFile = promisify(fs.readFile);

// Load client secrets from a local file.
readFile('client_secret.json')
.then(content => authorize(JSON.parse(content)))
.then(auth => {
    return new Promise((resolve, reject) => {
        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question('Enter the google drive folder id you want to list: ', (id) => {
            rl.close();
            resolve(id);
        });
    })
    .then(folderId => {
        console.time('yo')
        return makeGDriveFolderBackup(auth, folderId)
    })

})
.then(() => {
    console.timeEnd('yo');
})
.catch(err => console.error(err));
