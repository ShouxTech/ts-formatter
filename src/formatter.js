const fs = require('fs');
const vscode = require('vscode');

const GETSERVICE_REGEX = /local\s+(\w+)\s*=\s*game:GetService\(['"]([^'"]+)['"]\);?/;
const FONTFACE_PROPERTY = 'FontFace = Font.new(\r';
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

/**
 * @param {string[]} lines
 * @returns {[string?, number]}
 */
function getFirstServiceVariableLineDetails(lines) {
    let firstServiceLine;
    let firstServiceLineNum = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (!isLineAServiceVariable(line)) continue;

        firstServiceLine = line;
        firstServiceLineNum = i;
        break;
    }

    return [firstServiceLine, firstServiceLineNum];
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

/**
 * @param {string} line
 * @returns {boolean}
 */
function isServiceVariableFormatted(line) {
    if (line.includes('"')) return false;
    if (!line.includes(';')) return false;
    return true;
}

/**
 * @param {string} line
 * @returns {string}
 */
function correctServiceVariableFormat(line) {
    line = line.trim();
    line = line.replaceAll('"', '\'');
    if (line.at(line.length - 1) != CARRIAGE_RETURN_CHAR) { // Must come after the trim.
        line += CARRIAGE_RETURN_CHAR;
    }
    if (getLastCharacterBeforeCarriageReturn(line) != ';') {
        line = insertBeforeCarriageReturn(line, ';');
    }
    return line;
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

    const [firstServiceLine, firstServiceLineNum] = getFirstServiceVariableLineDetails(lines);

    const serviceVariables = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (i == firstServiceLineNum) continue;
        if (!isLineAServiceVariable(line)) continue;

        serviceVariables.push({lineNum: i, code: line, isAttachedToFirstService: isServiceVariableAttachedToFirstService(lines, i, firstServiceLineNum)});
    }

    editor.edit(editBuilder => {
        { // Service variable stuff.
            // Format the first service variable if required.
            if (firstServiceLine && !isServiceVariableFormatted(firstServiceLine)) {
                const startPos = document.lineAt(firstServiceLineNum).range.start;
                const endPos = document.lineAt(firstServiceLineNum).range.end;
                editBuilder.replace(new vscode.Range(startPos, endPos), correctServiceVariableFormat(firstServiceLine).trim());
            }

            // Delete service variable on current line if not isAttachedToFirstService.
            for (let i = serviceVariables.length - 1; i >= 0; i--) {
                const lineInfo = serviceVariables[i];

                if (lineInfo.isAttachedToFirstService) continue;

                const isLastLine = (lineInfo.lineNum == (document.lineCount - 1));

                const startPos = document.lineAt(lineInfo.lineNum).range.start;
                const endPos = isLastLine ? document.lineAt(lineInfo.lineNum).range.end : document.lineAt(lineInfo.lineNum + 1).range.start;
                editBuilder.delete(new vscode.Range(startPos, endPos));
            }

            // Move service variable under first service line and/or format service variables.
            for (let i = serviceVariables.length - 1; i >= 0; i--) {
                const lineInfo = serviceVariables[i];

                if (lineInfo.isAttachedToFirstService) {
                    if (isServiceVariableFormatted(lineInfo.code)) continue;
                    editBuilder.replace(document.lineAt(lineInfo.lineNum).range, correctServiceVariableFormat(lineInfo.code).trim());
                } else {
                    editBuilder.insert(new vscode.Position(firstServiceLineNum + 1, 0), correctServiceVariableFormat(lineInfo.code));
                }
            }
        }

        { // React Codify formatter for FontFace.
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                if (!line.includes(FONTFACE_PROPERTY)) continue;

                const params = [];
                let lineNum = i + 1;
                while (lineNum - i < 5) {
                    const line = lines[lineNum];
                    if (line.includes(')')) {
                        break;
                    }
                    params.push({line: lines[lineNum].trim(), lineNum: lineNum});
                    lineNum++;
                }
                if (lineNum - i >= 5) continue;

                editBuilder.delete(new vscode.Range(new vscode.Position(params[0].lineNum, 0), new vscode.Position(params[params.length - 1].lineNum + 2, 0)));

                // Rebuild on single line.
                editBuilder.insert(new vscode.Position(i, line.length - 1), params.map(paramData => paramData.line).join(' ') + '),');
            }
        }
    });
}

module.exports = format;