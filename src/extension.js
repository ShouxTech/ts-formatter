const vscode = require('vscode');
const format = require('./formatter');
const insertKnitModule = require('./insert-knit-module');
const { knitModules, listenForKnitModules } = require('./knit-modules-list');
const { initSuggestWallyModules } = require('./suggest-wally-modules');
const globals = require('./globals');

async function isKnitWorkspace() {
    const uris = await vscode.workspace.findFiles('**/KnitServer.lua');
	return uris.length > 0;
}

async function hasWallyPackages() {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) return false;

	const workspaceFolder = workspaceFolders[0];
	if (!workspaceFolder) return false;

	try {
		await vscode.workspace.fs.stat(vscode.Uri.file(workspaceFolder.uri.fsPath + '/Packages'));
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	context.subscriptions.push(vscode.workspace.onWillSaveTextDocument((event) => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		const document = event.document;
		const fileName = document.fileName;
		
		const isLuaFile = fileName.includes('.lua') || fileName.includes('.luau');
		if (!isLuaFile) return;

		format(fileName, editor, document);
    }));

	globals.isKnitWorkspace = await isKnitWorkspace();
	if (globals.isKnitWorkspace) {
		await listenForKnitModules();

		const insertKnitModuleCommandDisposable = vscode.commands.registerCommand('ts-formatter.insertKnitModule', (label, document) => {
			insertKnitModule(label, document);
		});
		context.subscriptions.push(insertKnitModuleCommandDisposable);

		const knitModulesCompletionItemsDisposable = vscode.languages.registerCompletionItemProvider(
			{
				scheme: 'file',
				language: 'lua',
			},
			{
				async provideCompletionItems(document, position, token, context) {
					const completionItems = [];

					try {
						for (const moduleName in knitModules) {
							const completionItem = new vscode.CompletionItem(moduleName, vscode.CompletionItemKind.Value);
							completionItem.command = {
								title: 'Insert Knit Module',
								command: 'ts-formatter.insertKnitModule',
								arguments: [completionItem.label, document],
							};
							completionItems.push(completionItem);
						}
					} catch (err) {}

					return completionItems;
				},
			}
		);
		context.subscriptions.push(knitModulesCompletionItemsDisposable);
	}

	if (await hasWallyPackages()) {
		await initSuggestWallyModules(context);
	}
}

function deactivate() {

}

module.exports = {
	activate,
	deactivate
};