const fs = require('fs');
const vscode = require('vscode');

const GETSERVICE_REGEX = /local\s+(\w+)\s*=\s*game:GetService\(['"]([^'"]+)['"]\);?/;
const SEMICOLON_CHAR = ';';
const CARRIAGE_RETURN_CHAR = '\r';
const NEWLINE_CHAR = '\n';

function isEndOfLine(char) {
    return char == SEMICOLON_CHAR || char == CARRIAGE_RETURN_CHAR || char == NEWLINE_CHAR
        || char == undefined; // End of file.
}

function isLineAServiceVariable(line) {
    const serviceVariableInfo = GETSERVICE_REGEX.exec(line);
    if (!serviceVariableInfo) return false;

    const serviceVariable = serviceVariableInfo[0];
    const index = serviceVariableInfo.index;

    const nextChar = line.at(index + serviceVariable.length);
    if (!isEndOfLine(nextChar)) return false; // Not a variable for the service. It's just used within the line like local localPlayer = game:GetService('Players').LocalPlayer.

    return true;
}

function isServiceVariableAttachedToFirstService(lines, lineNum, firstServiceLineNum) {
    let lineBeforeNum = lineNum - 1;
    let lineBefore = lines[lineBeforeNum];
    while (isLineAServiceVariable(lineBefore)) {
        if (lineBeforeNum == firstServiceLineNum) {
            return true;
        } else {
            lineBeforeNum--;
            lineBefore = lines[lineBeforeNum];
        }
    }
    return false;
}

function getFirstServiceVariableLineNum(lines) {
    let firstServiceLineNum = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (!isLineAServiceVariable(line)) continue;

        firstServiceLineNum = i;
        break;
    }

    return firstServiceLineNum;
}

function getLastCharacterBeforeCarriageReturn(line) {
    let index = line.length - 1;

    while (true) {
        const char = line.at(index);
        if (char == CARRIAGE_RETURN_CHAR) {
            index--;
        } else {
            return char;
        }
    }
}

function insertBeforeCarriageReturn(line, insertion) {
    let insertIndex = line.length - 1;
    if (line.at(insertIndex) == CARRIAGE_RETURN_CHAR) {
        insertIndex--;
    }
    line = line.slice(0, insertIndex + 1) + insertion + line.slice(insertIndex + 1);
    return line;
}

function correctServiceVariableFormat(code) {
    code = code.trim();
    code = code.replaceAll('"', '\'');
    if (code.at(code.length - 1) != CARRIAGE_RETURN_CHAR) { // Must come after the trim.
        code += CARRIAGE_RETURN_CHAR;
    }
    if (getLastCharacterBeforeCarriageReturn(code) != ';') {
        code = insertBeforeCarriageReturn(code, ';');
    }
    return code;
}

/**
 * @param {string} fileName
 * @param {vscode.TextEditor} editor
 * @param {vscode.TextDocument} document
 */
function format(fileName, editor, document) {
    const isLuaFile = fileName.includes('.lua') || fileName.includes('.luau');
    if (!isLuaFile) return;

    const code = document.getText();

    const lines = code.split('\n');

    const firstServiceLineNum = getFirstServiceVariableLineNum(lines);

    const linesToMove = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (i == firstServiceLineNum) continue;
        if (!isLineAServiceVariable(line)) continue;
        if (isServiceVariableAttachedToFirstService(lines, i, firstServiceLineNum)) continue;

        linesToMove.push({lineNum: i, code: line});
    }

    editor.edit(editBuilder => {
        for (let i = linesToMove.length - 1; i >= 0; i--) {
            const lineInfo = linesToMove[i];

            const isLastLine = (lineInfo.lineNum == (document.lineCount - 1));

            const startPos = document.lineAt(lineInfo.lineNum).range.start;
            const endPos = isLastLine ? document.lineAt(lineInfo.lineNum).range.end : document.lineAt(lineInfo.lineNum + 1).range.start;
            editBuilder.delete(new vscode.Range(startPos, endPos));
        }

        for (let i = linesToMove.length - 1; i >= 0; i--) {
            const lineInfo = linesToMove[i];

            editBuilder.insert(new vscode.Position(firstServiceLineNum + 1, 0), correctServiceVariableFormat(lineInfo.code));
        }
    });
}

module.exports = format;