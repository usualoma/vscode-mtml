// from https://zenn.dev/sosukesuzuki/articles/e65e95425e697e
import { build } from "esbuild";
import pkg from "../package.json" assert { type: "json" };
import path from "path";
import fs from "fs";

let wasmPlugin = {
    name: 'wasm',
    setup(build) {
        // Resolve ".wasm" files to a path with a namespace
        build.onResolve({ filter: /\.wasm$/ }, args => {
            // If this is the import inside the stub module, import the
            // binary itself. Put the path in the "wasm-binary" namespace
            // to tell our binary load callback to load the binary file.
            if (args.namespace === 'wasm-stub') {
                return {
                    path: args.path,
                    namespace: 'wasm-binary',
                }
            }

            // Otherwise, generate the JavaScript stub module for this
            // ".wasm" file. Put it in the "wasm-stub" namespace to tell
            // our stub load callback to fill it with JavaScript.
            //
            // Resolve relative paths to absolute paths here since this
            // resolve callback is given "resolveDir", the directory to
            // resolve imports against.
            if (args.resolveDir === '') {
                return // Ignore unresolvable paths
            }
            return {
                path: path.isAbsolute(args.path) ? args.path : path.join(args.resolveDir, args.path),
                namespace: 'wasm-stub',
            }
        })

        // Virtual modules in the "wasm-stub" namespace are filled with
        // the JavaScript code for compiling the WebAssembly binary. The
        // binary itself is imported from a second virtual module.
        build.onLoad({ filter: /.*/, namespace: 'wasm-stub' }, async (args) => ({
            contents: `import wasm from ${JSON.stringify(args.path)};
          export default (imports) => {
            const mod = new WebAssembly.Module(wasm.buffer);
            return new WebAssembly.Instance(mod, imports);
          }`,
        }))

        // Virtual modules in the "wasm-binary" namespace contain the
        // actual bytes of the WebAssembly file. This uses esbuild's
        // built-in "binary" loader instead of manually embedding the
        // binary data inside JavaScript code ourselves.
        build.onLoad({ filter: /.*/, namespace: 'wasm-binary' }, async (args) => ({
            contents: await fs.promises.readFile(args.path),
            loader: 'binary',
        }));
    },
};

const dependencies = Object.keys(pkg.dependencies ?? {});
const peerDependencies = Object.keys(pkg.peerDependencies ?? {});

const external = [...dependencies, ...peerDependencies, "vscode"];

/** @type {import('esbuild').BuildOptions} */
const options = {
    entryPoints: ["./src/extension.ts"],
    minify: false,
    bundle: true,
    outfile: "./out/extension.js",
    target: "node14.11",
    platform: "node",
    format: "cjs",
    external,
    plugins: [wasmPlugin],
};

if (process.env.WATCH === "true") {
    options.watch = {
        onRebuild(error, result) {
            if (error) {
                console.error("watch build failed:", error);
            } else {
                console.log("watch build succeeded:", result);
            }
        },
    };
}

build(options).catch((err) => {
    process.stderr.write(err.stderr);
    process.exit(1);
});
