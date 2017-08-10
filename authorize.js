import fs from 'fs';
import readline from 'readline';
import {promisify} from 'util';

import googleAuth from 'google-auth-library';

const readFile = promisify(fs.readFile);


// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/drive-nodejs-quickstart.json
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const TOKEN_PATH = './drive-nodejs-quickstart.json';




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
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
export default function authorize(credentials) {
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