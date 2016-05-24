import * as mssql from "mssql";
import * as moment from "moment";
import {SymbolToken} from "./types";

export function connect(config): Promise<void> {
	mssql.map.register(String, mssql.VarChar);
	return <Promise<void>>(<any>mssql).connect(config);
}

export function getProxifiers() {
	var q = `SELECT uri as url, ipaddress as ip
		FROM hermesex.dbo.Proxies AS P
		INNER JOIN hermesex.dbo.ProxyIPAddresses AS A ON P.ProxyID = A.ProxyID
		ORDER BY NEWID()`;
	return query(q);
}

export function getYahooSymbolsToSync(): Promise<SymbolToken[]> {
	var q = `declare @mostRecentDate date;
		set @mostRecentDate = hermes.dbo.FnGetMostRecentEodDate();

		SELECT internalId, symbolId
		FROM hermesex.dbo.FnGetActualSymbols(@mostRecentDate) as a
		where exists (select 1 from HermesEx.yhoo.Symbols as s where s.SymbolId = a.SymbolID)
		order by symbolId desc`;

	return query(q);
}

export function cloneTableSchema(src: string, dst: string) {
	var q = `begin try
		drop table ${dst};
		end try
		begin catch
		end catch;

		select *
		into ${dst}
		from ${src}
		where 1 <> 1;`;

	return query(q);
}

export function fetchPrices(rowCallback: { (row: {}): void }): Promise<number> {
	var today = moment().startOf("day");
	var firstDate = today.clone().startOf("month").subtract(18, "month");
	var cutoffDate = today.clone().subtract(14, "day");
	var q = `select p1.*, yp.RawMarketCap from hermes.dbo.sprices as p1
		left join hermesex.yhoo.EodPrices as yp on p1.internalid = yp.internalid and p1.[date] = yp.[date]
		where p1.[date] >= @firstDate
		and exists (select 1 from hermes.dbo.sprices as p2 where [date] >= @cutoffDate and p1.InternalID = p2.InternalID)
		and exists (select 1 from hermes.dbo.symbols as s where p1.InternalID = s.InternalID)
		and p1.internalid = 5970
		order by p1.internalid, p1.[date]`;
	return fetch(q, { firstDate: firstDate.toDate(), cutoffDate: cutoffDate.toDate() }, rowCallback);
}

export function query(q: string, parameters?: any): Promise<any[]> {
	var request = new mssql.Request();
	if (parameters) {
		Object.getOwnPropertyNames(parameters).forEach(name => {
			request.input(name, parameters[name]);
		});
	}
	return <any>request.query(q);
}

export function fetch(q: string, parameters: any, rowCallback: { (row: {}): void }): Promise<number> {
	return new Promise((resolve, reject) => {
		var request = new mssql.Request();
		request.stream = true;
		if (parameters) {
			Object.getOwnPropertyNames(parameters).forEach(name => {
				request.input(name, parameters[name]);
			});
		}

		request.on("done", resolve);
		request.on("error", reject);
		request.on("row", rowCallback);

		request.query(q);
	});
}

export async function beginTran() {
	var tran = new mssql.Transaction();
	await tran.begin();
	mssql["_tran"] = tran;
}

export async function commitTran() {
	var tran = <mssql.Transaction>mssql["_tran"];
	if (!tran)
		return;
	await tran.commit();
	delete mssql["_tran"];
}

export async function rollbackTran() {
	var tran = <mssql.Transaction>mssql["_tran"];
	if (!tran)
		return;
	await tran.rollback();
	delete mssql["_tran"];
}
