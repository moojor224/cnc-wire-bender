// this script takes the webpacked files and copies them directly into the index.html file
import copy from "copy";
import { inlineSource } from "inline-source";
import fs from "node:fs";
import path from "node:path";

const start = Date.now();
const htmlpath = path.resolve("./index.html");

try {
    const html = await inlineSource(htmlpath, {
        compress: true,
        rootpath: path.resolve(""),
        ignore: [],
        handlers: [
            function (source, context) {
                if (source.type === "json") {
                    console.log(source, context);
                    // source.content = "Hey! I'm overriding the file's content!";
                }
            }
        ]
    });
    try {
        fs.rmSync(path.resolve("cnc-wire-bender"), { recursive: true });
    } catch {}
    fs.mkdir(path.resolve("cnc-wire-bender"), () => {
        fs.writeFileSync(path.resolve("cnc-wire-bender", "index.html"), html);
        copy("public/**/*", "cnc-wire-bender", function (err, files) {
            if (err) throw err;
        });
    });
} catch (err) {
    console.error(err);
}
const end = Date.now();
console.log("Injected in " + (end - start) + "ms");
