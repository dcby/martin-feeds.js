"use strict";

export class ParseError extends Error {
	constructor(message?: string) {
		super(message || "Parse error.");
		(<any>Error).captureStackTrace(this, this.constructor);
	}
}

export interface SymbolToken {
	internalId: number;
	symbolId: string;
}
