import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  CodeAction,
  CodeActionKind,
  TextEdit,
  TextDocumentEdit,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

// 接続を管理するモジュール
let connection = createConnection(ProposedFeatures.all);

// ソースコードの同期を管理するモジュール
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
  let capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  // 初期化前のイベント
  // ソースコードの同期のモジュールを渡します
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      codeActionProvider: true,
      // completionProvider: {
      //   resolveProvider: true,
      // },
    },
  };
});

connection.onInitialized(() => {
  // Language Client と接続したときのイベント

  // 設定が変更されたとき、イベントを受け取るように設定します
  connection.client.register(
    DidChangeConfigurationNotification.type,
    undefined
  );
});

// // 設定
// interface LllSettings {
//   maxLength: number;
// }

// // ファイルごとの設定を管理する
// let documentSettings: Map<string, Thenable<LllSettings>> = new Map();

// // 設定変更時の置き換え
// connection.onDidChangeConfiguration(change => {
//   // すべてのドキュメントの設定を削除する
//   documentSettings.clear();
//   // すべてのドキュメントでリントを再実行する
//   documents.all().forEach(validateTextDocument);
// });

// /**
//  * ドキュメントの設定を取得します
//  **/
// function getDocumentSettings(resource: string): Thenable<LllSettings> {
//   // documentSettingsにキャッシュし、リントを実行するたびに実行しないようにする
//   let result = documentSettings.get(resource);
//   if (!result) {
//     result = connection.workspace.getConfiguration({
//       scopeUri: resource,
//       section: "lll"
//     });
//     documentSettings.set(resource, result);
//   }
//   return result;
// }

// // 閉じた時は設定を破棄する
// documents.onDidClose(e => {
//   documentSettings.delete(e.document.uri);
// });

// 開いた時のイベント
documents.onDidOpen((e: { document: TextDocument }) => {
  validateTextDocument(e.document);
});

// 保存した時のイベント
documents.onDidSave((e: { document: TextDocument }) => {
  validateTextDocument(e.document);
});

// リントの実行
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const diagnostics: Diagnostic[] = [];

  for (let i = 0; i < textDocument.lineCount; i++) {
    const line = textDocument.getText({
      start: { line: i, character: 0 },
      end: { line: i, character: Number.MAX_VALUE },
    });

    let m;
    if ((m = line.match(/(.*)lastn=/)) !== null) {
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Hint,
        range: {
          start: { line: i, character: m[1].length },
          end: { line: i, character: m[1].length + 5 },
        },
        message: "lastnは公開日時で優先してソートされるため、期待した結果にならないことがあります。多くの場合limitが適切です。",
        code: "lastn",
        source: "mtml",
      };
      diagnostics.push(diagnostic);
    }
    else if ((m = line.match(/(.*<mt:(EntryTitle))([^>]*)>/i)) !== null && !/encode_html=/.test(m[3])) {
      const diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Hint,
        range: {
          start: { line: i, character: m[1].length },
          end: { line: i, character: m[1].length },
        },
        message: `${m[2]}にencode_htmlがついていません`,
        code: "encode_html",
        source: "mtml",
      };
      diagnostics.push(diagnostic);
    }
  }

  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });

  // const filePath = Files.uriToFilePath(textDocument.uri);
  // if (!filePath) {
  //   // ファイルが特定できない場合は何もしない
  //   return;
  // }

  // // lllの実行
  // const cmd = `lll -l ${config.maxLength} "${filePath}"`;
  // connection.console.info(cmd);
  // const output = child_process.execSync(cmd, {
  //   encoding: "utf8"
  // });

  // let pattern = /^([^\s]+):(\d+): (.*)$/;

  // let problems = 0;
  // let diagnostics: Diagnostic[] = [];
  // for (let outputLine of output.split("\n")) {
  //   problems++;
  //   if (problems > 100) {
  //     // 100行以上該当する場合はストップ
  //     break;
  //   }

  //   // 正規表現で出力から行番号とメッセージを抽出
  //   const m = pattern.exec(outputLine);
  //   if (!m) {
  //     continue;
  //   }
  //   const line = parseInt(m[2]) - 1;
  //   const message = m[3];

  //   // エラーとして登録
  //   let diagnostic: Diagnostic = {
  //     severity: DiagnosticSeverity.Warning,
  //     range: {
  //       start: { line, character: 80 },
  //       end: { line, character: Number.MAX_VALUE }
  //     },
  //     message: message,
  //     source: "lll"
  //   };
  //   diagnostics.push(diagnostic);
  // }

  // ドキュメントの読み取り例
  // const text = textDocument.getText({
  //   start: { line: 0, character: 0 },
  //   end: { line: textDocument.lineCount, character: Number.MAX_VALUE },
  // })
}

connection.onCodeAction((params, token, workDoneProgress, resultProgress) => {
  const diagnostics = params.context.diagnostics.filter(
    (diag) => diag.source === "mtml"
  );

  const textDocument = documents.get(params.textDocument.uri);
  if (textDocument === undefined || diagnostics.length === 0) {
    return [];
  }
  const codeActions: CodeAction[] = [];

  diagnostics.forEach((diag) => {
    if (diag.code === "lastn") {
      // アクションの目的
      const title = "limitに置き換える";
      // 警告範囲の文字列取得
      // const originalText = textDocument.getText(diag.range);
      // 該当箇所を小文字に変更
      const edits = [TextEdit.replace(diag.range, "limit")];
      const editPattern = {
        documentChanges: [
          TextDocumentEdit.create(
            { uri: textDocument.uri, version: textDocument.version },
            edits
          ),
        ],
      };
      // コードアクションを生成
      const fixAction = CodeAction.create(
        title,
        editPattern,
        CodeActionKind.QuickFix
      );
      // コードアクションと警告を関連付ける
      fixAction.diagnostics = [diag];
      codeActions.push(fixAction);
    }
    else     if (diag.code === "encode_html") {
      // アクションの目的
      const title = "encode_htmlを追加する";
      // 警告範囲の文字列取得
      // const originalText = textDocument.getText(diag.range);
      // 該当箇所を小文字に変更
      const edits = [TextEdit.insert(diag.range.start, ` encode_html="1"`)];
      const editPattern = {
        documentChanges: [
          TextDocumentEdit.create(
            { uri: textDocument.uri, version: textDocument.version },
            edits
          ),
        ],
      };
      // コードアクションを生成
      const fixAction = CodeAction.create(
        title,
        editPattern,
        CodeActionKind.QuickFix
      );
      // コードアクションと警告を関連付ける
      fixAction.diagnostics = [diag];
      codeActions.push(fixAction);
    }
  });

  return codeActions;
});

// connection.onCompletion(
//   (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
//     return [
//       {
//         label: 'mt:Entries',
//         kind: CompletionItemKind.Text,
//         data: 1
//       },
//       {
//         label: 'mt:EntryTitle',
//         kind: CompletionItemKind.Text,
//         data: 2
//       },
//       {
//         label: 'mt:EntryBody',
//         kind: CompletionItemKind.Text,
//         data: 3
//       }
//     ];
//   }
// );

// // This handler resolves additional information for the item selected in
// // the completion list.
// connection.onCompletionResolve(
//   (item: CompletionItem): CompletionItem => {
//     if (item.data === 1) {
//       item.detail = 'TypeScript details';
//       item.documentation = 'TypeScript documentation';
//     } else if (item.data === 2) {
//       item.detail = 'JavaScript details';
//       item.documentation = 'JavaScript documentation';
//     }
//     return item;
//   }
// );

documents.listen(connection);

connection.listen();
