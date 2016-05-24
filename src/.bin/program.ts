#!/usr/bin/env node
import "source-map-support/register";
import * as yahoo from "../yahoo/client";

process.on("uncaughtException", err => {
	console.log(err.stack);
});

async function main() {
	try {
		await yahoo.syncFinancials();
	}
	catch (err) {
		console.log(err.stack);
	}
}

main();
