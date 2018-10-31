import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Entry, JumpDefinition } from './types';
import { StateParser } from './state-parser';


interface AppMapEntry {
    path: string;
    entries: Entry[];
    // TODO: make state entries
}

interface AppMap {
    [path: string]: AppMapEntry;
}

export class StateProvider implements vscode.TreeDataProvider<Entry> {
    private _disposable: vscode.Disposable;
    private appMap: AppMap;
    private currentAppPath: string | void;

    public readonly onDidChangeTreeDataEvent =  new vscode.EventEmitter<Entry | null> ();
    public readonly onDidChangeTreeData: vscode.Event<Entry | null> = this.onDidChangeTreeDataEvent.event;

    constructor() {
        let subscriptions: vscode.Disposable[] = [];
        this.appMap = {};
        this.currentAppPath = undefined;

        vscode.window.onDidChangeActiveTextEditor(() => this.onUpdateEditor(), this, subscriptions);
        vscode.workspace.onDidSaveTextDocument(() => this.onUpdateEditor(), this);
        
        // manually run update for first run
        this.onUpdateEditor();

        this._disposable = vscode.Disposable.from(...subscriptions);
    }

    dispose() {
        this._disposable.dispose();
    }

    async onUpdateEditor(filter?: (entry: JumpDefinition[]) => JumpDefinition[]) {
        const editor = vscode.window.activeTextEditor;
        if(!editor) {
            return;
        }
    
        try {
            const appPath = await this.getAppPathFromFile(editor.document.uri.fsPath);
            if(!this.appMap[appPath]) {
                this.appMap[appPath] = {
                    path: appPath,
                    entries: [
                        {
                            name: "Actions",
                            children: [],
                        },
                        {
                            name: "Selectors",
                            children: [],
                        }
                    ]
                };
            } 

            this.currentAppPath = appPath;
        } catch(err) {
            // no app found, reset to empty
            this.currentAppPath = undefined;
            return;
        }
        
        // update the state!
        const state = new StateParser(this.currentAppPath);
        this.appMap[this.currentAppPath].entries[0] = await state.getFunctionsForType('actions', filter);
        this.appMap[this.currentAppPath].entries[1] = await state.getFunctionsForType('selectors', filter);
        console.log(this.appMap[this.currentAppPath]);
        this.onDidChangeTreeDataEvent.fire();
        console.log("Finished updating app state!");
    }

    getAppPathFromFile(filename: string): Promise<string> {
        let dir = path.dirname(filename);

        return new Promise<string>((resolve, reject) => {
            if(dir === "/") {
                // no app in path above???
                reject();
                return;
            }
            
            fs.readdir(dir, async (err, items) => {
                if(items.indexOf("state") > -1) {
                    resolve(dir);
                } else {
                    resolve(this.getAppPathFromFile(dir));
                }
            });
        });
    }

    getChildren(element?: Entry): vscode.ProviderResult<Entry[]> {
        // root element, return app root
        if(!element && this.currentAppPath && this.appMap[this.currentAppPath]) {
            return this.appMap[this.currentAppPath].entries;
        } else if(element && element.children && this.currentAppPath) {
            return element.children;
        }
        return [];
    }

    getTreeItem(element: Entry): vscode.TreeItem {
        return new vscode.TreeItem(element.name, element.children && element.children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    }
}