const vscode = require('vscode');
const { getModuleNameFromUri } = require('./utils');
const globals = require('./globals');

const REQUIRE_REGEX = /^local\s+\w+\s*=\s*require\(/;
const GETSERVICE_REGEX = /local\s+\w+\s*=\s*game:GetService\(/;

/**
 * @param {vscode.TextDocument} document
 */
function getLastRequireLine(document) {
    const lines = document.getText().split('\n');
    const requireLines = lines.filter(line => REQUIRE_REGEX.test(line));
    if (requireLines.length === 0) return;

    return lines.indexOf(requireLines[requireLines.length - 1]);
}

/**
 * @param {vscode.TextDocument} document
 */
function getLastGetServiceLine(document) {
    const lines = document.getText().split('\n');
    const getServiceLines = lines.filter(line => GETSERVICE_REGEX.test(line));
    if (getServiceLines.length === 0) return;

    return lines.indexOf(getServiceLines[getServiceLines.length - 1]);
}

/**
 * @param {string} moduleName
 * @param {vscode.TextDocument} document
 */
function insertWallyModule(moduleName, document) {
    let targetLine = 0;

    const lastRequireLine = getLastRequireLine(document);
    if (lastRequireLine !== undefined) {
        targetLine = lastRequireLine + 1;
    } else {
        const lastGetServiceLine = getLastGetServiceLine(document);
        if (lastGetServiceLine !== undefined) {
            targetLine = lastGetServiceLine + 2;
        }
    }

    const edit = new vscode.WorkspaceEdit();
    edit.insert(document.uri, new vscode.Position(targetLine, 0), `local ${moduleName} = require(ReplicatedStorage.${globals.isKnitWorkspace ? 'Knit' : 'Src'}.Packages.${moduleName});\r\n`);
    vscode.workspace.applyEdit(edit);
}

/**
 * @param {vscode.ExtensionContext} context
 */
async function initSuggestPackageModules(context) {
    const modules = (await vscode.workspace.findFiles('Packages/*')).map(module => getModuleNameFromUri(module.path));

    context.subscriptions.push(vscode.commands.registerCommand('ts-formatter.insertWallyModule', (label, document) => {
        insertWallyModule(label, document);
    }));

    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(
        {
            scheme: 'file',
            language: 'lua',
        },
        {
            async provideCompletionItems(document, position, token, context) {
                const completionItems = [];

                try {
                    for (const moduleName of modules) {
                        const completionItem = new vscode.CompletionItem(moduleName, vscode.CompletionItemKind.Value);
                        completionItem.command = {
                            title: 'Insert Wally Module',
                            command: 'ts-formatter.insertWallyModule',
                            arguments: [completionItem.label, document],
                        };
                        completionItems.push(completionItem);
                    }
                } catch (err) {}

                return completionItems;
            },
        }
    ));
}

module.exports = {
    initSuggestPackageModules,
};