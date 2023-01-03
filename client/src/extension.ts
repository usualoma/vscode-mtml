import * as vscode from "vscode";
import { parse, serialize, FunctionTagStyle } from "mtml-parser";
import tags from "./tags.json";
import modifiers from "./modifiers.json";

interface Config {
  completionLanguages: string[];
  prefix: string;
  functionTagStyle: keyof typeof FunctionTagStyle;
  referenceManualLanguages: string[];
  foldingLanguages: string[];
}

export function activate(context: vscode.ExtensionContext) {
  let {
    completionLanguages,
    prefix,
    functionTagStyle,
    referenceManualLanguages,
    foldingLanguages,
  } = vscode.workspace.getConfiguration("language-mtml") as unknown as Config;
  let mtColon = !!prefix.match(/^mt:/i);

  vscode.workspace.onDidChangeConfiguration((e) => {
    ({
      completionLanguages,
      prefix,
      functionTagStyle,
      referenceManualLanguages,
      foldingLanguages,
    } = vscode.workspace.getConfiguration(
      "language-mtml"
    ) as unknown as Config);
    mtColon = !!prefix.match(/^mt:/i);
  });

  const foldingRangeProvider = vscode.languages.registerFoldingRangeProvider(
    ["mtml", "css"],
    {
      provideFoldingRanges(document, context, token) {
        if (!foldingLanguages.find((l) => l === document.languageId)) {
          return [];
        }

        const ranges: vscode.FoldingRange[] = [];
        const text = document.getText();
        const regExp =
          /(?:^|\n|\r\n)\s*<mt:?(\w+)(?:.|\r|\n)*(?:\n|\r\n)\s*<\/mt:?\1/gi;
        let match;
        while ((match = regExp.exec(text))) {
          const newLineCount = match[0]
            .match(/^(\n|\r\n)*/)![0]
            .replace("\r", "").length;
          const startPos = document.positionAt(match.index + newLineCount);
          const endPos = document.positionAt(match.index + match[0].length);
          const range = new vscode.FoldingRange(
            startPos.line,
            endPos.line,
            vscode.FoldingRangeKind.Region
          );
          ranges.push(range);
        }

        return ranges;
      },
    }
  );

  const hoverProvider = vscode.languages.registerHoverProvider(
    ["mtml", "html", "css"],
    {
      provideHover(document, position, token) {
        if (!referenceManualLanguages.find((l) => l === document.languageId)) {
          return;
        }

        const range = document.getWordRangeAtPosition(position, /[a-zA-Z:_]+/);
        if (!range) {
          return Promise.reject("no MT tag found");
        }

        const word: string = document
          .lineAt(position.line)
          .text.slice(range.start.character, range.end.character)
          .toLowerCase();

        const modifierData = modifiers[word as keyof typeof modifiers];
        if (modifierData) {
          return Promise.resolve(
            new vscode.Hover(
              new vscode.MarkdownString(`
${modifierData.name}

${modifierData.description}
  
[${vscode.l10n.t("Reference", vscode.env.language)}](${modifierData.url})
  `)
            )
          );
        }

        const tagNameMatch = word.match(/^mt:?(.*)/i);
        if (!tagNameMatch) {
          return Promise.reject("no MT tag found");
        }

        const tagData = tags[tagNameMatch[1] as keyof typeof tags];
        if (!tagData) {
          return Promise.reject("no MT tag found");
        }

        return Promise.resolve(
          new vscode.Hover(
            new vscode.MarkdownString(`
${tagData.name}

${tagData.description}

${Object.values(tagData.modifiers)
  .map((m) => `* ${m.name}${m.description ? `: ${m.description}` : ""}`)
  .join("\n")}

[${vscode.l10n.t("Reference", vscode.env.language)}](${tagData.url})
`)
          )
        );
      },
    }
  );

  const collectVarNames = (document: vscode.TextDocument): string[] => {
    const items: string[] = [];
    const re =
      /<mt:?(?:set)?var[^>]+name=["']([^$"']+)|\bsetvar=["']([^$"']+)/gi;
    const text = document.getText();
    let m;
    while ((m = re.exec(text))) {
      items.push(m[1] || m[2]);
    }
    return items;
  };
  const completionItemProvider =
    vscode.languages.registerCompletionItemProvider(
      ["mtml", "html", "css"],
      {
        provideCompletionItems(
          document: vscode.TextDocument,
          position: vscode.Position,
          token: vscode.CancellationToken,
          context: vscode.CompletionContext
        ) {
          if (!completionLanguages.find((l) => l === document.languageId)) {
            return;
          }

          const varRange = document.getWordRangeAtPosition(
            position,
            /['"$a-zA-Z_-]+/
          );
          const varWord: string | undefined =
            varRange &&
            document
              .lineAt(position.line)
              .text.slice(varRange.start.character, varRange.end.character)
              .toLowerCase();
          if (varWord) {
            if (varWord.match(/^["']\$/)) {
              return collectVarNames(document).map((name) => {
                return new vscode.CompletionItem(
                  name,
                  vscode.CompletionItemKind.Variable
                );
              });
            }
          }

          let backwardText: string = "";
          for (
            let i = Math.max(0, position.line - 10);
            i < position.line;
            i++
          ) {
            backwardText += document.lineAt(i).text;
          }
          backwardText += document
            .lineAt(position.line)
            .text.slice(0, position.character);

          const tagNameMatch = backwardText.match(/<\$?mt:?(\w+)[^>]+$/);
          if (tagNameMatch) {
            if (varWord && varWord.match(/^["']/)) {
              return [];
            }

            const tagData =
              tags[tagNameMatch[1].toLowerCase() as keyof typeof tags];
            const tagAttrItems =
              Object.values(tagData?.modifiers).map((modifier) => {
                const c = new vscode.CompletionItem(modifier.name);

                let placeholder;
                if (modifier.name.match(/^(?:regex_)?replace/)) {
                  placeholder = '"/${1:search}/","${2:replace}"';
                } else if (modifier.name === "op") {
                  placeholder = `"\${1|add,sub,mul,div,mod,inc,dec,+,-,*,/,%,++,--|}"`;
                } else if (modifier.name === "function") {
                  placeholder = `"\${1|pop,shift,count|}"`;
                } else if (modifier.name === "name") {
                  const varNames = collectVarNames(document);
                  if (varNames.length > 0) {
                    placeholder = `"\${1|${collectVarNames(document).join(
                      ","
                    )}|}"`;
                  } else {
                    placeholder = '"${1}"';
                  }
                } else {
                  let value = modifier.value ?? "";
                  if (value === "N") {
                    value = "";
                  }

                  if (value !== "") {
                    placeholder = `"\${1|${value}|}"`;
                  } else {
                    placeholder = '"${1}"';
                  }
                }

                c.insertText = new vscode.SnippetString(
                  `${modifier.name}=${placeholder}`
                );
                c.documentation = new vscode.MarkdownString(`
  ${modifier.name}

  ${modifier.description}

  [${vscode.l10n.t("Reference", vscode.env.language)}](${modifier.url})
  `);
                return c;
              }) || [];
            const modifierItems = Object.values(modifiers).map((modifier) => {
              const c = new vscode.CompletionItem(modifier.name);

              let placeholder;
              if (modifier.name.match(/^(?:regex_)?replace/)) {
                placeholder = '"/${1:search}/","${2:replace}"';
              } else {
                placeholder = `"\${1}"`;
              }

              c.insertText = new vscode.SnippetString(
                `${modifier.name}=${placeholder}`
              );

              c.insertText = new vscode.SnippetString(
                `${modifier.name}=${placeholder}`
              );
              c.documentation = new vscode.MarkdownString(`
  ${modifier.name}

  ${modifier.description}

  [${vscode.l10n.t("Reference", vscode.env.language)}](${modifier.url})
  `);

              return c;
            });

            return [...tagAttrItems, ...modifierItems];
          }

          const tagRange = document.getWordRangeAtPosition(
            position,
            /[<a-zA-Z:$]+/
          );
          const tagWord: string | undefined =
            tagRange &&
            document
              .lineAt(position.line)
              .text.slice(tagRange.start.character, tagRange.end.character)
              .toLowerCase();
          if (tagWord?.match(/^(?:<$|<\$$|<\$?mt)/)) {
            const isFunction = !!tagWord.match(/^(?:<\$)/);
            const startsWithMTColon = !!tagWord.match(/^<\$?mt:/i);
            const tagItems = Object.values(tags)
              .map((tagData) => {
                if (isFunction && tagData.type !== "function") {
                  return;
                }

                const c = new vscode.CompletionItem(
                  tagData.name.replace("MT", prefix)
                );
                c.insertText =
                  mtColon && startsWithMTColon
                    ? tagData.name.replace("MT", "")
                    : tagData.name.replace("MT", prefix);
                c.documentation = new vscode.MarkdownString(`
${tagData.name}

${tagData.description}

${Object.values(tagData.modifiers)
  .map((m) => `* ${m.name}${m.description ? `: ${m.description}` : ""}`)
  .join("\n")}

[${vscode.l10n.t("Reference", vscode.env.language)}](${tagData.url})
  `);

                return c;
              })
              .filter((v): v is vscode.CompletionItem => !!v);

            return tagItems;
          }
        },
      },
      "<",
      "$"
    );

  const documentRangeFormattingEditProvider =
    vscode.languages.registerDocumentRangeFormattingEditProvider("mtml", {
      provideDocumentRangeFormattingEdits(
        document: vscode.TextDocument,
        range: vscode.Range
      ): vscode.TextEdit[] | undefined {
        const text = document.getText(range);
        const formattedText = serialize(parse(text), {
          prefix,
          functionTagStyle: FunctionTagStyle[functionTagStyle],
        });
        if (text === formattedText) {
          return;
        }

        return [new vscode.TextEdit(range, formattedText)];
      },
    });

  context.subscriptions.push(
    completionItemProvider,
    hoverProvider,
    foldingRangeProvider,
    documentRangeFormattingEditProvider
  );
}
