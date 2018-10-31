'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {StateProvider} from './tree';
import { actionGenerator } from './generators';
import { Entry, JumpDefinition } from './types';
import * as Fuse from 'fuse.js';


function insertText(text: string) {
    var editor = vscode.window.activeTextEditor;

    if(editor) {
        editor.edit(
            edit => {
                if(editor) {
                    editor.selections.forEach(
                        selection => {
                            edit.delete(selection);
                            edit.insert(selection.start, text);
                        });
                    }
                }
            );
        }
    }

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    let createActionDisposable = vscode.commands.registerTextEditorCommand("tangerine.createAction", () => {
        console.log("Creating action!");
        
        return vscode.window.showInputBox({
            placeHolder: "Enter space-separated name for the new action e.g: \'update items\'",
        }).then((name: string | undefined) => {
            if(!name) {
                return Promise.reject();
            }
            
            // todo get action context
            insertText(actionGenerator('ui', name));
        });
    });

    let stateTreeProvider = new StateProvider();
    let stateTreeView = vscode.window.createTreeView('state-tree-view', { treeDataProvider: stateTreeProvider });

    stateTreeView.onDidChangeSelection((e: vscode.TreeViewSelectionChangeEvent<Entry>) => {
        console.log(e);
        const jump = e.selection[0].jump;
        if(jump) {
            vscode.workspace.openTextDocument(`${jump.file}`).then(document => {
                vscode.window.showTextDocument(document).then(editor => {
                    const position = new vscode.Position(jump.line, 0);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenter);
                    vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
                });
            });
        }
    });
    vscode.commands.registerCommand('tangerine.search', () => 
    vscode.window.showInputBox({placeHolder: 'Tangerine item to search for'})
    .then((name?: string) => {
        if(name) {
            const searcher = (entries: JumpDefinition[]): JumpDefinition[] => {
                console.log(entries);
                const options: Fuse.FuseOptions<JumpDefinition> = {
                    shouldSort: true,
                    threshold: 0.3,
                    location: 0,
                    distance: 100,
                    maxPatternLength: 32,
                    minMatchCharLength: 1,
                    keys: [
                        'name'
                    ]
                };
                const fuse = new Fuse(entries, options);
                const results =  fuse.search(name);
                console.log(results);
                return results;
            };
            stateTreeProvider.onUpdateEditor(searcher);
        }
        
    }));


    context.subscriptions.push(stateTreeView);
    context.subscriptions.push(createActionDisposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}