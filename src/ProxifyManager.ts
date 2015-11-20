"use strict";
import * as url from "url";
import {RandomQueue} from "./RandomQueue";

interface ProxifyToken {
	url: string;
	ip: string;
}

export class ProxifyManager {
	private _queue: RandomQueue<ProxifyToken>;
	private _opts: { login: string, password: string };

	constructor(data: ProxifyToken[], opts: { login: string, password: string }) {
		this._queue = new RandomQueue(data);
		this._opts = opts;
	}

	makeUrl(surl: string): string {
		var token = this._queue.next();
		var ret = url.parse(token.url);
		ret.query = {
			l: this._opts.login,
			p: this._opts.password,
			i: token.ip,
			t: 15,
			u: surl
		};

		return url.format(ret);
	}
}
