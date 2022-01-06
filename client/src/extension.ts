import * as path from "path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  DocumentSelector,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  ServerOptions,
  TransportKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
} from "vscode-languageclient/node";

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  // Language Server のプログラムのパス
  let serverModule = context.asAbsolutePath(
    path.join("server", "out", "server.js")
  );

  // Language Server の設定
  let serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      // デバッグオプションはデバッグ時のみ付与する
      options: {
        execArgv: ["--nolazy", "--inspect=6010"],
      },
    },
  };

  const documentSelector = [{ language: "mtml" }] as DocumentSelector;

  // Language Client の設定
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    // 同期する設定項目
    synchronize: {
      // "lll."の設定を指定しています
      configurationSection: "lll",
    },
  };

  // Language Client の作成
  client = new LanguageClient(
    // 拡張機能のID
    "mtml",
    // ユーザ向けの名前（出力ペインで使用されます）
    "MTML",
    serverOptions,
    clientOptions
  );

  // Language Client の開始
  client.start();

  vscode.languages.registerCompletionItemProvider("mtml", {
    provideCompletionItems(document, position, token, context) {
      const ctxText = document.getText(
        new vscode.Range(position.line, 0, position.line, position.character)
      );

      if (ctxText.match(/<mt:Entries [^>]*$/)) {
        return [
          {
            label: "limit",
            kind: CompletionItemKind.Text,
            data: 1,
          },
          {
            label: "offset",
            kind: CompletionItemKind.Text,
            data: 2,
          },
          {
            label: "lastn",
            kind: CompletionItemKind.Text,
            data: 3,
          },
        ];
      } else if (ctxText.match(/<mt:EntryTitle [^>]*$/)) {
        return [
          {
            label: `encode_html`,
            kind: CompletionItemKind.Text,
            data: 1,
          },
          {
            label: "regex_replace",
            kind: CompletionItemKind.Text,
            data: 2,
          },
        ];
      }

      return [
        {
          label: "mt:Entries",
          kind: CompletionItemKind.Text,
          data: 1,
        },
        {
          label: "mt:EntryTitle",
          kind: CompletionItemKind.Text,
          data: 2,
        },
        {
          label: "mt:EntryBody",
          kind: CompletionItemKind.Text,
          data: 3,
        },
        {
          label: "mt:Contents",
          kind: CompletionItemKind.Text,
          data: 4,
        },
      ];
    },
  });

  vscode.commands.registerCommand("mtml.OpenTagManual", (tag: string) => {
    vscode.env.openExternal(
      vscode.Uri.parse(
        `https://www.movabletype.jp/documentation/appendices/tags/${tag.toLowerCase()}.html`
      )
    );
  });

  vscode.languages.registerCodeLensProvider("mtml", {
    provideCodeLenses(document, token) {
      const lenses: vscode.CodeLens[] = [];

      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const all =
          line.text.match(/(.*<mt:?entries|.*<mt:?entrytitle|.*<mt:?entrybody|.*<mt:?contents)/gi) || [];
        let offset = 0;
        all.forEach((m) => {
          const tag = m.replace(/.*mt:?/, "");

          offset += m.length;

          const lens = new vscode.CodeLens(
            new vscode.Range(i, offset - tag.length, i, offset),
            {
              title: `mt:${tag}`,
              command: "mtml.OpenTagManual",
              arguments: [tag],
            }
          );
          lenses.push(lens);
        });
      }

      return lenses;
    },
    resolveCodeLens(codeLens, token) {
      console.log(codeLens.command);
      return undefined;
    },
  });
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
