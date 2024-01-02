const vscode = require('vscode');

const KNIT_REQUIRE_REGEX = /local\s+Knit\s*=\s*require\(\s*([^\s;]+)\.Packages\.Knit\s*\);/;
const KNITINIT_REGEX = /^function\s+([\w$]+)Controller:KnitInit\(\)/;

function isLineKnitRequire(line) {
    const regexInfo = KNIT_REQUIRE_REGEX.exec(line);
    return regexInfo ? true : false;
}

function isLineKnitInit(line) {
    const regexInfo = KNITINIT_REGEX.exec(line);
    return regexInfo ? true : false;
}

/**
 * @param {string} moduleName
 * @param {vscode.TextDocument} document 
 */
function insertKnitModule(moduleName, document) {
    const isController = moduleName.includes('Controller');
    
    const code = document.getText();
    const lines = code.split('\n');

    let knitRequireLine;
    let knitInitLine;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (isLineKnitRequire(line)) {
            knitRequireLine = i;
            continue;
        }

        if (isLineKnitInit(line)) {
            knitInitLine = i;
            continue;
        }

        if (knitRequireLine && knitInitLine) break;
    }

    if (!knitRequireLine || !knitInitLine) return;

    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, new vscode.Position(knitRequireLine + 1, 0), `local ${moduleName};\r\n`);
    edit.insert(document.uri, new vscode.Position(knitInitLine + 1, 0), `\t${moduleName} = Knit.Get${isController ? 'Controller' : 'Service'}('${moduleName}');\r\n`);
    vscode.workspace.applyEdit(edit);
}

module.exports = insertKnitModule;