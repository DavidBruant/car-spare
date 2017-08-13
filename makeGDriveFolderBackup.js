import fs from 'fs';
import path from 'path';
import {promisify} from 'util';

import google from 'googleapis';

import withExponentialBackoff from './withExponentialBackoff';

const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GOOGLE_DOC_MIME_TYPE = 'application/vnd.google-apps.document';
const GOOGLE_SPREADSHEET_MIME_TYPE = 'application/vnd.google-apps.spreadsheet';
const GOOGLE_DRAWING_MIME_TYPE = 'application/vnd.google-apps.drawing';
const GOOGLE_PRESENTATION_MIME_TYPE = 'application/vnd.google-apps.presentation';
const GOOGLE_SCRIPT_MIME_TYPE = 'application/vnd.google-apps.script';


const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);


const drive = google.drive('v3');
const list = promisify(drive.files.list);

function listFolderFiles(auth, folderId) {
    return list({ auth, q: `'${folderId}' in parents` })
}


function exportToFile(auth, fileId, filename, mimeType){
    return new Promise((resolve, reject) => {
        var dest = fs.createWriteStream(filename);
        drive.files.export({ auth, fileId, mimeType }, (err) => {
            if(err){
                reject(err);
            }
        })
        .on('end', resolve)
        .on('error', e => {
            unlink(filename)
            .then(() => reject(e))
            .catch(() => reject(e));
        })
        .pipe(dest);
    });
}

function downloadToFile(auth, fileId, filename){
    return new Promise((resolve, reject) => {
        var dest = fs.createWriteStream(filename);
        drive.files.get({ auth, fileId, alt: 'media' }, (err) => {
            if(err){
                reject(err);
            }
        })
        .on('end', resolve)
        .on('error', e => {
            unlink(filename)
            .then(() => reject(e))
            .catch(() => reject(e));
        })
        .pipe(dest);
    });
}

const listFolderFilesWithBackoffAndRetry = withExponentialBackoff(listFolderFiles);
const exportToFileWithBackoffAndRetry = withExponentialBackoff(exportToFile);
const downloadToFileWithBackoffAndRetry = withExponentialBackoff(downloadToFile);

export default function makeGDriveFolderBackup(auth, gDriveFolderId, dirPath = './tmp'){
    // verify the dir exists
    // verify it's a git repo; make it so if not https://github.com/dtc-innovation/garagiste/issues/3 

    return listFolderFilesWithBackoffAndRetry(auth, gDriveFolderId)
    .then(({files}) => {
        return Promise.all(
            files.map(f => {

                const localFilename = path.join(
                    dirPath, 
                    f.name.replace(new RegExp(path.sep, 'g'), '_')
                )

                console.log('Start', f.name, dirPath);

                (() => {
                    switch(f.mimeType){
                        case GOOGLE_DRIVE_FOLDER_MIME_TYPE: {
                            return mkdir(localFilename)
                            .then(() => makeGDriveFolderBackup(auth, f.id, localFilename) )
                        }
                        case GOOGLE_DOC_MIME_TYPE: {
                            return exportToFileWithBackoffAndRetry(
                                auth, f.id, `${localFilename}.odt`, 'application/vnd.oasis.opendocument.text'
                            )
                        }
                        case GOOGLE_SPREADSHEET_MIME_TYPE: {
                            return exportToFileWithBackoffAndRetry(
                                auth, f.id, `${localFilename}.ods`, 'application/x-vnd.oasis.opendocument.spreadsheet'
                            )
                        }
                        case GOOGLE_DRAWING_MIME_TYPE: {
                            return exportToFileWithBackoffAndRetry(
                                auth, f.id, `${localFilename}.svg`, 'image/svg+xml'
                            )
                        }
                        case GOOGLE_PRESENTATION_MIME_TYPE: {
                            return exportToFileWithBackoffAndRetry(
                                auth, f.id, `${localFilename}.odp`, 'application/vnd.oasis.opendocument.presentation'
                            )
                        }
                        case GOOGLE_SCRIPT_MIME_TYPE: {
                            return exportToFileWithBackoffAndRetry(
                                auth, f.id, `${localFilename}.json`, 'application/vnd.google-apps.script+json'
                            )
                        }
                        default: {
                            return downloadToFileWithBackoffAndRetry(auth, f.id, localFilename)
                        }
                    }
                })()
                .then(ret => {
                    console.log('End', f.name, dirPath);
                    return ret;
                })
                .catch(e => {
                    console.error('Error', f.name, dirPath, e);
                })
                
            })
        )
    })

    
}
