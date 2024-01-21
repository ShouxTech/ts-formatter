const vscode = require('vscode');
const format = require('./formatter');
const insertKnitModule = require('./insert-knit-module');
const { knitModules, listenForKnitModules } = require('./knit-modules-list');

async function isKnitWorkspace() {
    const uris = await vscode.workspace.findFiles('**/KnitServer.lua');
	return uris.length > 0;
}

/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
	const onSaveDisposable = vscode.workspace.onWillSaveTextDocument((event) => {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;

		const document = event.document;
		const fileName = document.fileName;
		
		const isLuaFile = fileName.includes('.lua') || fileName.includes('.luau');
		if (!isLuaFile) return;

		format(fileName, editor, document);
    });
    context.subscriptions.push(onSaveDisposable);

	if (await isKnitWorkspace()) {
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
}

function deactivate() {

}

module.exports = {
	activate,
	deactivate
};