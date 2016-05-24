import * as fs from "fs";
import * as util from "util";
import * as assert from "assert";
import * as yahoo from "../yahoo/client";
import * as parser from "../yahoo/parser";
import * as lib from "../lib";

// async function test() {
//     let industries = await yahoo.getIndustries();
//     fs.writeFileSync(String.raw`D:\!w\!S\Martin\feeds.js\.test\raw-industries.csv`,
//         industries.map(e => `${e.id};${e.name}`)
//             .join("\r\n"), "utf8");
// }

console.log(util.inspect(lib, { depth: null, colors: true }));
return;

async function test() {
    let fd = fs.openSync(String.raw`D:\!w\!S\Martin\feeds.js\.test\symbols.csv`, "w");
    let industries = await yahoo.getIndustries();
    for (let i = 0; i < industries.length; i++) {
        await lib.sleep(500);
        console.log(`[${industries[i].id}] ${industries[i].name}`);
        let industry = await yahoo.getIndustry(industries[i].id);
        assert(industries[i].name === industry.name, "");
        industry.symbols.forEach(s => {
            let line = `${s.id};${s.name};${s.hasData ? 1 : 0};${industry.sector.name};${industry.name}\r\n`;
            fs.writeSync(fd, line);
        });
    }
    fs.closeSync(fd);
}

test();
