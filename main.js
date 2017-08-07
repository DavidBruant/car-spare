import fs from 'fs';
import readline from 'readline';
import {promisify} from 'util';

import google from 'googleapis';
import googleAuth from 'google-auth-library';

import withExponentialBackoff from './withExponentialBackoff';

const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

const drive = google.drive('v3');

const list = promisify(drive.files.list);
const readFile = promisify(fs.readFile);


// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/drive-nodejs-quickstart.json
const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];
const TOKEN_PATH = './drive-nodejs-quickstart.json';

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
        return listFilesRec(auth, folderId)
    })

})
.then(() => {
    console.timeEnd('yo');
})
.catch(err => console.error(err));

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials) {
    var clientSecret = credentials.web.client_secret;
    var clientId = credentials.web.client_id;
    var redirectUrl = credentials.web.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    return readFile(TOKEN_PATH)
    .then(token => {
        oauth2Client.credentials = JSON.parse(token);
        return oauth2Client;
    })
    .catch(err => {
        return getNewToken(oauth2Client)
    })
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve, reject) => {
        rl.question('Enter the code from that page here: ', function (code) {
            rl.close();
            oauth2Client.getToken(code, function (err, token) {
                if (err) {
                    reject(err);
                }
                else{
                    oauth2Client.credentials = token;
                    storeToken(token);
                    resolve(oauth2Client);
                }
            });
        });
    })
    
}


/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ', TOKEN_PATH);
}

/**
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listFolderFiles(auth, folderId) {
    return list({ auth, q: `'${folderId}' in parents` })
}



function listFilesRec(auth, rootFolderId){
    const listFolderFilesWithBackoff = withExponentialBackoff(listFolderFiles, auth);

    return listFolderFilesWithBackoff(auth, rootFolderId)
    .then(({files}) => {
        console.log(
            '\t', rootFolderId,
            '\n'+(files.map(f => `- ${f.name} - ${f.mimeType}`).join('\n'))
        )
        
        return Promise.all(
            files
            .filter(f => f.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE)
            .map(f => listFilesRec(auth, f.id))
        )
    })
}


