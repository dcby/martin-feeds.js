"use strict";
import * as path from "path";
import * as client from "../httpClient";
import * as parser from "./parser";
import * as sql from "../sqlClient";
import * as lib from "../lib";
import {ProxifyManager} from "../ProxifyManager";
import {SymbolToken} from "../types";

const urls = {
	industries: "http://biz.yahoo.com/p/sum_conameu.html",
	industry: "http://biz.yahoo.com/p/{id}conameu.html",
	incomeStatement: "http://finance.yahoo.com/q/is?s={id}",
	balanceSheet: "http://finance.yahoo.com/q/bs?s={id}",
	cashFlow: "http://finance.yahoo.com/q/cf?s={id}"
};

const exemplaryInternalId = 5970; // msft

interface FinData {
	incomeStatement: parser.FinanceParseResult;
	balanceSheet: parser.FinanceParseResult;
	cashFlow: parser.FinanceParseResult
}

export function syncFinancials(config?: any): Promise<{}> {
	var _resolve, _reject, _proxify: ProxifyManager,
		_queue: SymbolToken[], _active = [],
		_cntTotal: number, _cntDone = 0, _error;
	const _pms = new Promise((resolve, reject) => { _resolve = resolve, _reject = reject });
	const _config = Object.assign(lib.readConfig(), config || {});
	const _factMap = lib.readYamlSync("src/yahoo/fact-map.yaml");

	sql.connect(_config.database)
		.then(() => sql.cloneTableSchema("hermesex.yhoo.IncomeStmts", "hermesex.tmp.[yhoo.IncomeStmts]"))
		.then(() => sql.cloneTableSchema("hermesex.yhoo.BalanceSheetStmts", "hermesex.tmp.[yhoo.BalanceSheetStmts]"))
		.then(() => sql.cloneTableSchema("hermesex.yhoo.CashFlowStmts", "hermesex.tmp.[yhoo.CashFlowStmts]"))
		.then(() => sql.getProxifiers())
		.then(data => {
			_proxify = new ProxifyManager(data, _config.proxify);
			return sql.getYahooSymbolsToSync();
		})
		.then(data => {
			//_queue = data;
			_queue = data.filter(value => value.symbolId === "MSFT");
			//_queue = data.filter(value => value.symbolId.charAt(0) !== "M");
			//_queue = data.filter(value => value.symbolId === "JPM");
			_cntTotal = _queue.length;
			setImmediate(next);
		})
		.catch(err => _reject(err));

	function next() {
		var token;
		while (_queue.length && _active.length < _config.yahoo.financials.concurrency && !_error) {
			token = _queue.shift();
			getItem(token)
				.then(data => { onItem(token, data); })
				.catch(err => {
					lib.log(err.message);
					lib.log(token);
					_error = _error || err;
				});
			_active.push(token);
		}

		if (_error)
			_reject(_error);
		else if (!_queue.length && !_active.length) {
			_resolve();
		}
	}

	function getItem(token: SymbolToken) {
		var data_: any = {};
		return getItemData(token, "incomeStatement")
			.then(data => { data_.incomeStatement = parser.parseFinance(data); })
			.then(() => getItemData(token, "balanceSheet"))
			.then(data => { data_.balanceSheet = parser.parseFinance(data); })
			.then(() => getItemData(token, "cashFlow"))
			.then(data => { data_.cashFlow = parser.parseFinance(data); })
			.then(() => {
				if (token.internalId === exemplaryInternalId)
					validateExemplaryData(data_); // this will throw if data is bad
				return data_;
			})
			.then(data => storeItem(token, data));
	}

	function getItemData(token: SymbolToken, dataKind: string) {
		var suffix = dataKind === "incomeStatement" ? "-is" : dataKind === "balanceSheet" ? "-bs" : "-cf";
		var file = makeFilePath(token.internalId, suffix);

		return lib.getFileStat(file)
			.then(data => {
				if (data.mtime.getTime() + _config.yahoo.financials.cacheTtl > Date.now())
					return lib.readFile(file);
				throw new Error("Obsolete.");
			})
			.catch(_ => {
				const opts = {
					url: urls[dataKind].replace("{id}", token.symbolId),
					proxify: _proxify,
					retry: _config.yahoo.financials.retry
				};
				var data_;
				return client.getString(opts)
					.then(data => {
						data_ = data;
						return lib.writeFile(makeFilePath(token.internalId, "-bs"), data.data);
					})
					.then(() => data_.data);
			});
	}

	function validateExemplaryData(data: FinData) {
		var err = data.incomeStatement.error || data.balanceSheet.error || data.cashFlow.error;
		if (err)
			throw err;
		if (Math.min(data.incomeStatement.data.length, data.balanceSheet.data.length, data.cashFlow.data.length) < 4)
			throw new Error("Exemplary data is not valid. Bad number of quarters.");

		data.incomeStatement.data.forEach(stmt => {
			_factMap.incomeStatement.forEach(mapItem => {
				if (stmt.facts[mapItem.raw] === undefined)
					throw new Error(`Exemplary data is not valid. Raw metric '${mapItem.raw}' is not found.`);
			});
		});
		data.balanceSheet.data.forEach(stmt => {
			_factMap.balanceSheet.forEach(mapItem => {
				if (stmt.facts[mapItem.raw] === undefined)
					throw new Error(`Exemplary data is not valid. Raw metric '${mapItem.raw}' is not found.`);
			});
		});
		data.cashFlow.data.forEach(stmt => {
			_factMap.cashFlow.forEach(mapItem => {
				if (stmt.facts[mapItem.raw] === undefined)
					throw new Error(`Exemplary data is not valid. Raw metric '${mapItem.raw}' is not found.`);
			});
		});
	}

	function storeItem(token: SymbolToken, data: FinData) {
		if (!data.incomeStatement.data || !data.balanceSheet.data || !data.cashFlow.data)
			return Promise.resolve([]);
		return Promise.resolve()
			.then(() => {
				var promises = [], q: string, pars;
				var columns = _factMap.incomeStatement.filter(v => v.db).map(v => v.db);
				data.incomeStatement.data.forEach(stmt => {
					q = `insert into hermesex.tmp.[yhoo.IncomeStmts]
				(InternalId, PeriodEndDate, IsPreliminary, ${columns.join(", ") })
				values (@InternalId, @PeriodEndDate, @IsPreliminary, ${columns.map(v => "@" + v).join(", ") })`;
					pars = {
						internalId: token.internalId,
						periodEndDate: stmt.date,
						isPreliminary: false
					};
					_factMap.incomeStatement.filter(v => v.db).forEach(v => pars[v.db] = stmt.facts[v.raw]);
					promises.push(sql.query(q, pars));
				});
				return Promise.all(promises);
			})
			.then(() => {
				var promises = [], q, pars;
				var columns = _factMap.balanceSheet.filter(v => v.db).map(v => v.db);
				data.balanceSheet.data.forEach(stmt => {
					q = `insert into hermesex.tmp.[yhoo.BalanceSheetStmts]
				(InternalId, PeriodEndDate, IsPreliminary, ${columns.join(", ") })
				values (@InternalId, @PeriodEndDate, @IsPreliminary, ${columns.map(v => "@" + v).join(", ") })`;
					pars = {
						internalId: token.internalId,
						periodEndDate: stmt.date,
						isPreliminary: false
					};
					_factMap.balanceSheet.filter(v => v.db).forEach(v => pars[v.db] = stmt.facts[v.raw]);
					promises.push(sql.query(q, pars));
				})
				return Promise.all(promises);
			})
			.then(() => {
				var promises = [], q, pars;
				var columns = _factMap.cashFlow.filter(v => v.db).map(v => v.db);
				data.cashFlow.data.forEach(stmt => {
					q = `insert into hermesex.tmp.[yhoo.CashFlowStmts]
				(InternalId, PeriodEndDate, IsPreliminary, ${columns.join(", ") })
				values (@InternalId, @PeriodEndDate, @IsPreliminary, ${columns.map(v => "@" + v).join(", ") })`;
					pars = {
						internalId: token.internalId,
						periodEndDate: stmt.date,
						isPreliminary: false
					};
					_factMap.cashFlow.filter(v => v.db).forEach(v => pars[v.db] = stmt.facts[v.raw]);
					promises.push(sql.query(q, pars));
				})
				return Promise.all(promises);
			});
	}

	function onItem(token: SymbolToken, data) {
		_active.splice(_active.indexOf(token), 1);
		console.log(++_cntDone + " of " + _cntTotal);
		setImmediate(next);
	}

	function makeFilePath(internalId: number, suffix: string): string {
		var now = new Date();
		var quarter = Math.floor(now.getUTCMonth() / 3) + 1;
		var sid = internalId.toString();
		return path.join(_config.yahoo.financials.cacheDir, "" + now.getUTCFullYear(), "" + quarter, sid.charAt(0), sid + suffix + ".html");
	}

	return _pms;
}
