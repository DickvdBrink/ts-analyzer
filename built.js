var fs = require("fs");

//node ..\built\local\tsc.js analyzer.ts && node built.js && node output.js ../src

if(fs.existsSync("output.js")) {
	fs.unlinkSync("output.js");
}

fs.appendFileSync("output.js", fs.readFileSync("lib/typescriptServices.js", "utf8"));
fs.appendFileSync("output.js", fs.readFileSync("analyzerwalker.js", "utf8"));
fs.appendFileSync("output.js", fs.readFileSync("analyzer.js", "utf8"));
