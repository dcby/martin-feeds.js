"use strict";
import * as http from "http";
import * as https from "https";
import * as url from "url";
import * as util from "util";
import * as zlib from "zlib";
import {ProxifyManager} from "./ProxifyManager";

export interface Response<T> {
	headers: any[];
	statusCode: number;
	statusMessage: string;
	data: T;
}

export function getString(options: { url: string, proxify?: ProxifyManager, gzip?: boolean, retry?: number }): Promise<Response<string>> {
	var _resolve, _reject, retry = 0;
	var _pms = new Promise((resolve, reject) => { _resolve = resolve, _reject = reject });

	next();

	return _pms;

	function next() {
		query(options)
			.then(data => _resolve(data))
			.catch(err => {
				if (+options.retry && ++retry < +options.retry) {
					util.log(err.stack);
					setImmediate(next);
				}
				else
					_reject(err);
			});
	}

	function query(options) {
		var _resolve, _reject, _request, _chunks;
		var _pms = new Promise((resolve, reject) => { _resolve = resolve, _reject = reject });
		var opts = prepareOptions(options);
		var request = opts.protocol === "https:" ? https.request : http.request;

		_request = request(opts);
		_request.setTimeout(options.timeout || 15000, () => _request.socket.destroy());
		_request.on("error", err => {
			util.log(util.inspect(opts, { depth: 10 }));
			_reject(err);
		});
		_request.on("response", r => {
			_chunks = [];
			var stream = r;
			if (r.headers["content-encoding"] === "gzip") {
				stream = zlib.createGunzip();
				r.pipe(stream);
			}
			stream.setEncoding("utf8");
			stream.on("data", chunk => _chunks.push(chunk));
			stream.on("end", () => _resolve({
				headers: r.headers,
				statusCode: r.statusCode,
				statusMessage: r.statusMessage,
				data: _chunks.join("")
			}));
			stream.on("error", err => {
				util.log(util.inspect(opts, { depth: 10 }));
				_reject(err);
			});
		});
		_request.end();

		return _pms;
	}
}

function prepareOptions(options) {
	var u = options.url;
	if (options.proxify)
		u = options.proxify.makeUrl(u);
	var ret = <any>url.parse(u);
	if (options.gzip)
		ret.headers = {
			"Accept-Encoding": "gzip"
		};

	return ret;
}
