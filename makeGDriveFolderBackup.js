import fs from 'fs';
import path from 'path';
import {promisify} from 'util';

import google from 'googleapis';

import withExponentialBackoff from './withExponentialBackoff';

const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GOOGLE_DOC_MIME_TYPE = 'application/vnd.google-apps.document';
const GOOGLE_SPREADSHEET_MIME_TYPE = 'application/vnd.google-apps.spreadsheet';

const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);


const drive = google.drive('v3');
const list = promisify(drive.files.list);

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

function exportToFile(auth, fileId, filename, mimeType){
    return new Promise((resolve, reject) => {
        var dest = fs.createWriteStream(filename);
        drive.files.export({ auth, fileId, mimeType }, (err) => {
            if(err){
                console.error('drive.files.export err', err);
                // TODO retry if isUsageRateError
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
                console.error('drive.files.export err', err);
                // TODO retry if isUsageRateError
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

export default function makeGDriveFolderBackup(auth, gDriveFolderId, dirPath = './tmp'){
    // verify the dir exists
    // verify it's a git repo; make it so if not https://github.com/dtc-innovation/garagiste/issues/3 

    const listFolderFilesWithBackoff = withExponentialBackoff(listFolderFiles, auth);

    return listFolderFilesWithBackoff(auth, gDriveFolderId)
    .then(({files}) => {
        console.log(
            '\t', gDriveFolderId,
            '\n'+(files.map(f => `- ${f.name} - ${f.mimeType}`).join('\n'))
        )
        
        return Promise.all(
            files
            .map(f => {
                const correspondingFilename = path.join(
                    dirPath, 
                    f.name.replace(new RegExp(path.sep, 'g'), '_')
                )

                switch(f.mimeType){
                    case GOOGLE_DRIVE_FOLDER_MIME_TYPE: {
                        return mkdir(correspondingFilename)
                        .then(() => makeGDriveFolderBackup(auth, f.id, correspondingFilename) );
                    }
                    case GOOGLE_DOC_MIME_TYPE: {
                        return exportToFile(
                            auth, 
                            f.id, 
                            `${correspondingFilename}.odt`, 
                            'application/vnd.oasis.opendocument.text'
                        )
                    }
                    case GOOGLE_SPREADSHEET_MIME_TYPE: {
                        return exportToFile(
                            auth, 
                            f.id, 
                            `${correspondingFilename}.ods`, 
                            'application/x-vnd.oasis.opendocument.spreadsheet'
                        )
                    }
                    default: {
                        return downloadToFile(auth, f.id, correspondingFilename)
                    }
                }
            })
        )
    })

    
}
