/// <reference path="lib/typescriptServices.d.ts" />
/// <reference path="analyzerwalker.ts" />

declare var require: any;
declare var process: any;

var fs = require("fs");
var path = require("path");

var walk = function (dir, extensions) {
    var results: string[] = [];
    var list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = path.join(dir, file);
        var stat = fs.statSync(file);
        // Check given directory recursive.
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file, extensions));
        } else {
            var extension = path.extname(file);
            if (extension === '' || !Array.isArray(extensions) || extensions.indexOf(extension.substring(1)) > -1) {
                results.push(file);
            }
        }
    });
    return results;
}

// first is node, second is the script being loaded and the third should be a directory or file

if (process.argv.length !== 3) {
    console.log("Invalid arguments: expected a directory");
    process.exit(1);
}

var files = walk(process.argv[2], ["ts"]).map((f) => {return { filename: f, version: 0, text: undefined } });

var servicesHost: ts.LanguageServiceHost = {
    getScriptFileNames: () => ts.map(files, f => f.filename),
    getScriptVersion: (filename) => ts.forEach(files,
        f => f.filename === filename ? f.version.toString() : undefined),
    getScriptSnapshot: (filename) => {
        var file = ts.forEach(files, f => f.filename === filename ? f : undefined);
        var readText = () => file.text ?
            file.text : file.text = fs.readFileSync(filename).toString();
        return {
            getText: (start, end) => readText().substring(start, end),
            getLength: () => readText().length,
            getLineStartPositions: () => TypeScript.TextUtilities.parseLineStarts(file.text),
            getChangeRange: (oldSnapshot) => undefined
        };
    },
    log: (message) => console.log(message),
    getCurrentDirectory: () => undefined,
    getScriptIsOpen: () => true,
    getDefaultLibFilename: () => "lib.d.ts",
    getLocalizedDiagnosticMessages: () => undefined,
    getCancellationToken: () => undefined,
    getCompilationSettings: () => { return <ts.CompilerOptions>{}; },
};

var registry = ts.createDocumentRegistry();
var services = ts.createLanguageService(servicesHost, registry);

ts.forEach(files, (file) => {
    var filename = file.filename;

    var document = registry.acquireDocument(
        filename,
        servicesHost.getCompilationSettings(),
        servicesHost.getScriptSnapshot(filename),
        "0",
        true
        );
    var isDeclaration = ts.isDeclarationFile(document);
    // skip declaration files
    if (isDeclaration) {
        return;
    }

    var snapshot = TypeScript.SimpleText.fromScriptSnapshot(document.getScriptSnapshot());
    var syntaxTree = TypeScript.Parser.parse(filename, snapshot, ts.ScriptTarget.Latest, isDeclaration);

    // create vistior
    var visitor = new AnalyzerWalker(syntaxTree, services);
    TypeScript.visitNodeOrToken(visitor, syntaxTree.sourceUnit());
    if (visitor.errors.length !== 0) {
        console.log(filename);
        visitor.errors.every((error) => {
            console.log("\t" + error.error + " " + (error.line + 1) + ":" + (error.col + 1));
            return true;
        });
    }
});
