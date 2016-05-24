"use strict";
import * as cheerio from "cheerio";
import * as moment from "moment";
import {ParseError} from "../types";

var re = /(\d+)conameu\.html/;

export interface ParseResult {
	error?: Error;
	data?: any;
}

export interface FinanceParseResult extends ParseResult {
	data?: FinanceStatement[];
}

export interface FinanceStatement {
	date: Date;
	facts: any;
}

export function parseFinance(raw: string): FinanceParseResult {
	var ret;
	var $ = cheerio.load(raw),
		$tmp, $trs;

	// multiplier marker
	if (!$("td[align='right'] > small:contains('All numbers in thousands')").length)
		return { error: new ParseError() };

	$trs = $("table.yfnc_tabledata1 > tr > td > table > tr");
	if (!$trs.length)
		return { error: new ParseError() };
	$tmp = $trs.eq(0).children();
	// check text of very first cell
	if ($tmp.eq(0).text() !== "Period Ending")
		return { error: new ParseError() };
	// get remaining cells
	$tmp = $tmp.slice(1);
	// if (!$tmp.length)
	// 	return error(__line);

	var data: FinanceStatement[] = [];
	// parse first row with dates
	$tmp.each(function () {
		var $this = $(this);
		var mom = moment.utc($this.text(), "MMM D, YYYY");
		if (!mom.isValid()) {
			ret = { error: new ParseError() };
			return false;
		}
		data.push({ date: mom.toDate(), facts: {} });
	});

	if (ret)
		return ret;

	// iterate over rows
	$trs.each(function (index) {
		if (index < 1)
			return; // skip first row

		var $this = $(this);
		if ($this.children().length <= data.length)
			return; // skip if row separator

		var fact, idx = 0;
		$this.children().each(function () {
			$this = $(this);
			var value; value = $this.text().trim();
			if (!value)
				return;

			if (!fact)
				fact = value;
			else {
				// try to parse value
				if (value === "-")
					value = null;
				else {
					value = value
						.replace(/,/g, "")
						.replace(/^\((\d+)\)$/, "-$1");
					value = parseFloat(value) / 1000; // yahoo provides data in thousands while we want it in millions
					if (isNaN(value)) {
						ret = { error: new ParseError() };
						return false;
					}
				}
				data[idx++].facts[fact] = value;
			}
		});
	});

	if (ret)
		return ret;

	ret = {
		data: data
	};
	return ret;
}

export function parseSectors(raw): ParseResult {
	let $temp, s;
	let $ = cheerio.load(raw);
	$temp = $("table[cellpadding=2]");
	s = $temp.find("th b").eq(0).text();
	if (s !== "Sector")
		return { error: new ParseError("'Sector' signature not found.") };

	let data = $temp.find("tr > td:first-child a")
		.get()
		.map(e => $(e))
		.map($e => {
			return {
				id: parseInt($e.attr("href").replace("conameu.html", "")),
				name: $e.text().trim().replace(/\s+/g, " ")
			};
		});

	return { data: data };
}

export function parseSector(raw): ParseResult {
	let $temp, s;
	let $ = cheerio.load(raw);
	$temp = $("table[cellpadding=2]");
	s = $temp.find("th b").eq(0).text();
	if (s !== "Description")
		return { error: new ParseError("'Description' signature not found.") };

	let data = $temp.find("tr > td:first-child a")
		.get()
		.map(e => $(e))
		.map($e => {
			return {
				id: parseInt($e.attr("href").replace("conameu.html", "")),
				name: $e.text().trim().replace(/\s+/g, " ")
			};
		});

	return { data: data };
}

export function parseIndustries(raw) {
	var ret;
	var $ = cheerio.load(raw);
	var $items = $("table[bgcolor='dcdcdc'] > tr > td > table[width='100%'] > tr > td:first-child > a");
	if (!$items.length)
		return { error: new ParseError() };
	// <a href="431conameu.html"><font face="arial" size="-1">Accident &amp; Health Insurance</font></a>
	var data = [];
	$items.each(function () {
		var $this = $(this);
		var match = re.exec($this.attr("href"));
		if (!match) {
			ret = { error: new ParseError() };
			return false;
		}
		data.push({
			id: parseInt(match[1]),
			name: $this.text().replace(/\s+/g, " ")
		});
	});

	if (ret)
		return ret;

	ret = { data: data };
	return ret;
}

export function parseIndustry(raw) {
	var ret, id, name, sector, match;
	var $ = cheerio.load(raw);
	var $tmp;
	var $items = $("table[bgcolor='dcdcdc'] > tr > td > table[width='100%'] > tr > td:first-child");
	if (!$items.length)
		return { error: new ParseError() };

	// sector
	$tmp = $items.eq(0).find("a");
	if ($tmp.length !== 1)
		return { error: new ParseError() };
	match = re.exec($tmp.attr("href"));
	if (!match)
		return { error: new ParseError() };
	sector = {
		id: parseInt(match[1]),
		name: $tmp.text()
	};

	// industry
	$tmp = $items.eq(1).find("font").eq(1);
	if ($tmp.length !== 1)
		return { error: new ParseError() };
	name = "";
	$tmp.contents().filter(function () { return this.type === "text" }).each(function () {
		name += this.data;
	});
	name = name.replace(/\s+/g, " ").replace(/[()]/g, "").trim();
	match = /\/(\d+)\.html/.exec($tmp.find("a").attr("href"));
	if (!match)
		return { error: new ParseError() };
	id = parseInt(match[1]);

	// symbols
	$items = $items.slice(3).find("font");
	if (!$items.length)
		console.warn("No symbols found on industry page.");
	var symbols = [];
	$items.each(function () {
		var $this = $(this);
		var $cts = $this.contents();
		if ($cts.length === 2) {
			symbols.push({
				id: $cts.eq(1).text().trim().replace(/[()]/g, ""),
				name: $cts.eq(0).text().replace(/\s+/g, " ").trim(),
				hasData: false
			});
		}
		else if ($cts.length === 4) {
			symbols.push({
				id: $cts.eq(2).text().trim(),
				name: $cts.eq(0).text().replace(/\s+/g, " ").trim(),
				hasData: true
			});
		}
		else {
			ret = { error: new ParseError() };
			return false;
		}
	});

	if (ret)
		return ret;

	ret = {
		data: {
			id: id,
			name: name,
			sector: sector,
			symbols: symbols
		}
	};
	return ret;
}
