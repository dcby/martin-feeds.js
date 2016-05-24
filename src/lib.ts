"use strict";
import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import * as mkdirp from "mkdirp";
import * as yaml from "js-yaml";

const configFile = "martin-feeds.yaml";

export function readConfig() {
	var fpath = path.resolve(configFile);
	return readYamlSync(fpath);
}

export function readYamlSync(file: string) {
	var data = fs.readFileSync(file, "utf8");
	return yaml.load(data);
}

export function writeFile(file: string, data: string): Promise<{}> {
	return new Promise((resolve, reject) => {
		mkdirp(path.dirname(file), err => {
			if (err) {
				reject(err);
				return;
			}
			fs.writeFile(file, data, err => {
				if (err) {
					reject(err);
					return;
				}
				resolve();
			});
		});
	});
}

export function readFile(file): Promise<string> {
	return new Promise((resolve, reject) => {
		fs.readFile(file, "utf8", (err, data) => {
			if (err)
				reject(err);
			else
				resolve(data);
		});
	});
}

export function getFileStat(file): Promise<fs.Stats> {
	return new Promise((resolve, reject) => {
		fs.stat(file, (err, data) => {
			if (err)
				reject(err);
			else
				resolve(data);
		});
	});
}

export function sleep(milliseconds) {
	return new Promise(resolve => {
		setTimeout(resolve, milliseconds);
	});
}

export var log = util.log;
