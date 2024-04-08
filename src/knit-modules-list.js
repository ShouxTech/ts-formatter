const vscode = require('vscode');
const { getModuleNameFromUri } = require('./utils');

const knitModules = {};

const KNIT_MODULE_REGEX = /.*(?:Controller|Service)\.lua$/;
const KNIT_MODULE_BLOB = '**/*{Controller,Service}.lua';

function addModuleIfKnitModule(uri) {
    const uriString = uri.toString();

    const isKnitModule = KNIT_MODULE_REGEX.exec(uriString) ? true : false;
    if (!isKnitModule) return;

    const moduleName = getModuleNameFromUri(uriString);
    knitModules[moduleName] = true;
}

function removeModuleIfKnitModule(uri) {
    const uriString = uri.toString();

    const isKnitModule = KNIT_MODULE_REGEX.exec(uriString) ? true : false;
    if (!isKnitModule) return;

    const moduleName = getModuleNameFromUri(uriString);
    delete knitModules[moduleName];
}

async function listenForKnitModules() {
    // Add existing modules.
    const uris = await vscode.workspace.findFiles(KNIT_MODULE_BLOB);
    uris.forEach(uri => {
        addModuleIfKnitModule(uri);
    });

    vscode.workspace.onDidCreateFiles((e) => {
        const files = e.files;
        for (const uri of files) {
            addModuleIfKnitModule(uri);
        }
    });
    vscode.workspace.onDidDeleteFiles((e) => {
        const files = e.files;
        for (const uri of files) {
            removeModuleIfKnitModule(uri);
        }
    });
    vscode.workspace.onDidRenameFiles((e) => {
        const files = e.files;
        for (const {newUri, oldUri} of files) {
            removeModuleIfKnitModule(oldUri);
            addModuleIfKnitModule(newUri);
        }
    });
}

module.exports = {
    knitModules,
    listenForKnitModules,
};