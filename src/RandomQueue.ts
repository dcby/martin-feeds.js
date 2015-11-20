"use strict";

export class RandomQueue<T> {
	private _queue: T[];
	private _backQueue: T[];
	
	constructor(data: T[]) {
		this.init(data);
	}
	
	next(): T {
		if (!this._queue.length)
			this.init(this._backQueue);
		var ret = this._queue.shift();
		this._backQueue.push(ret);
		return ret;
	}

	private init(src: T[]) {
		this._queue = src;
		this._backQueue = [];
		this._queue.sort(() => 0.5 - Math.random());
	}
}
