# Garagiste

This project aims at creating a tool that properly backups the content of a Google Drive folder.

## Context

[Tools to backup Google Drive exist](https://www.google.com/drive/download/), but for GDoc and GSpreadSheet documents, they create links to be opened in the browser (maybe [backup and sync](https://www.blog.google/products/photos/introducing-backup-and-sync-google-photos-and-google-drive/) change that, haven't tried).

Also, these tools usually don't work on Linux...

## Goals

* Create a git-versioned backup of a Google Drive folder that properly backups all useful content

### Non-goals

* Making a full-featured sync tool

