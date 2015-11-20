"use strict";
import * as sql from "mssql";
import {SymbolToken} from "./types";

export function connect(config): Promise<void> {
	sql.map.register(String, sql.VarChar);
	return <Promise<void>>(<any>sql).connect(config);
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

export function query(q: string, parameters?: any): Promise<any[]> {
	var request = new sql.Request();
	if (parameters) {
		Object.getOwnPropertyNames(parameters).forEach(name => {
			request.input(name, parameters[name]);
		});
	}
	return <any>request.query(q);
}
