import * as tedious from "tedious";
import * as moment from "moment";

var conn = new tedious.Connection({
	server: "127.0.0.1",
	//userName: "sa",
	//password: "sa"
});

conn.on("connect", err => {
	if (err) {
		console.log(err.stack);
		return;
	}

	console.log("ok");
	//query();
});

function query() {
	var today = moment().startOf("day");
	var firstDate = today.clone().startOf("month").subtract(18, "month");
	var cutoffDate = today.clone().subtract(14, "day");
	var q = `select p1.*, yp.RawMarketCap as c from hermes.dbo.sprices as p1
		left join hermesex.yhoo.EodPrices as yp on p1.internalid = yp.internalid and p1.[date] = yp.[date]
		where p1.[date] >= @firstDate
		and exists (select 1 from hermes.dbo.sprices as p2 where [date] >= @cutoffDate and p1.InternalID = p2.InternalID)
		and exists (select 1 from hermes.dbo.symbols as s where p1.InternalID = s.InternalID)
		--and p1.internalid = 5970
		order by p1.internalid, p1.[date]`;

	var req = new tedious.Request(q, err => {
		if (err) {
			console.log(err.stack);
			return;
		}
		conn.close();
	});

	req.addParameter("firstDate", tedious.TYPES.DateTime, firstDate.toDate());
	req.addParameter("cutoffDate", tedious.TYPES.DateTime, cutoffDate.toDate());

	var id = 0;
	var cnt = 0;
	req.on("row", row => {
		// if (row[0].value !== id) {
		// 	id = row[0].value;
		// 	cnt++;
		// 	if (!(cnt % 100))
		// 		console.log(cnt);
		// }
		cnt++;
		if (cnt % 10000 == 0)
			console.log(cnt);
	});

	conn.execSql(req);
}