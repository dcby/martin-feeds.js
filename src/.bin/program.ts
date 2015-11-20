"use strict";
import "source-map-support/register";
import * as yahoo from "../yahoo/client";
import * as lib from "../lib";

async function main() {
	try {
		await yahoo.syncFinancials();
		lib.log("done");
	}
	catch (err) {
		lib.log(err.stack);
	}
}

main();
