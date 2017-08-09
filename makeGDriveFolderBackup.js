import {promisify} from 'util';

import google from 'googleapis';

import withExponentialBackoff from './withExponentialBackoff';

const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

const drive = google.drive('v3');
const list = promisify(drive.files.list);

function listFolderFiles(auth, folderId) {
    return list({ auth, q: `'${folderId}' in parents` })
}



export default function listFilesRec(auth, rootFolderId){
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


 function makeGDriveFolderBackup(gDriveFolderId, dirPath){
    // verify the dir exists
    // verify it's a git repo; make it so if not https://github.com/dtc-innovation/garagiste/issues/3 
}
