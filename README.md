# Garagiste

This project aims at creating a tool that properly backups the content of a Google Drive folder.

## Context

[Tools to backup Google Drive exist](https://www.google.com/drive/download/), but for GDoc and GSpreadSheet documents, they create links to be opened in the browser (maybe [backup and sync](https://www.blog.google/products/photos/introducing-backup-and-sync-google-photos-and-google-drive/) change that, haven't tried).

Also, these tools usually don't work on Linux...

## Goals

* Create a git-versioned backup of a Google Drive folder that properly backups all useful content

### Non-goals

* Making a full-featured sync tool

## Install

- [Create a Google Project](https://console.developers.google.com/)
- Activate the "Google Drive API" for this project
- Create "web application" credentials allowing `http://localhost/` as redirect URL
- Download the corresponding JSON file credentials

```sh
git clone git@github.com:dtc-innovation/garagiste.git
cd garagiste
npm ci
# Add the credential file with name `client_secret.json` to the directory
```


## Run

(remove any existing `drive-nodejs-quickstart.json` file if any)

```sh
npm start

## The first time
# This tells you to go to a page starting with `https://accounts.google.com/o/oauth2/auth`
# ... which redirects to http://localhost/?code=SOME_CODE
# Take SOME_CODE and feed it to the command line

## All the time
# Provide the Google Drive directory id to backup
```

This will backup the Google Drive directory to a `tmp` directory at the root of this project
