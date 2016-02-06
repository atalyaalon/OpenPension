var fs = require('fs'),
    _ = require('underscore'),
    moment = require('moment'),
    handlebars = require('handlebars'),
    createTableTemplate = handlebars.compile(fs.readFileSync(__dirname + '/sql/createTable.hbs').toString()),
    emptyTableTemplate = handlebars.compile(fs.readFileSync(__dirname + '/sql/emptyTable.hbs').toString()),
    getFundValueTemplate = handlebars.compile(fs.readFileSync(__dirname + '/sql/getFundValue.hbs').toString()),
    deleteFundValuesTemplate = handlebars.compile(fs.readFileSync(__dirname + '/sql/deleteFundValues.hbs').toString()),
    metaTable = require(__dirname + '/common/MetaTable').getMetaTable(),
    columnsNames = metaTable.englishColumns,
    columnsTypes = metaTable.dataTypes;

var Promise = require('bluebird');
var pg = require('pg');
var squel = require('squel');

var defaultColumnnNames = ['managing_body', 'fund' ,'report_year', 'report_qurater', 'instrument_type', 'instrument_sub_type'];
var defaultColumnnTypes = ['string', 'number' ,'number', 'number', 'string', 'string'];

columnsNames = defaultColumnnNames.concat(columnsNames);
columnsTypes = defaultColumnnTypes.concat(columnsTypes);

var defaultColumnsNamesMapping = defaultColumnnNames.map(function(c) { return { columnName: c }; });

var config;
try {
  config = require("./_config");
} catch (ignore){
  config = require('./config');
}

exports.config = config;

var tableName = config.table;


function query(sqlQuery){
  return new Promise(function(resolve,reject){
    pg.connect(config.connection_string,
        function(err, client, done) {

          if (err){
            return reject(err);
          }
        
          client.query(sqlQuery, function (err, result) {
            client.end();
            if (err){
              return reject(err);
            }
            else{
              return resolve(result.rows);
            }
          });
        });
  });
}

function createTable(tableName){

  if (_.isEmpty(tableName) ){
    throw "tableName cannot be empty";
  }

	var data = {
		tableName : tableName
	};

	var createTableSql = createTableTemplate(data);

	return query(createTableSql);
}

function emptyTable(tableName){

  if (_.isEmpty(tableName) ){
    throw "tableName cannot be empty";
  }

  var data = {
    tableName : tableName
  };

  var emptyTableSql = emptyTableTemplate(data);

  return query(emptyTableSql);
}

function getFundValue(managing_body, report_year, report_quarter, fund, tableName){

  if (_.isEmpty(tableName) ){
    tableName = config.table;
  }

  var data = {
    tableName : tableName,
    report_year : report_year,
    report_quarter : report_quarter,
    fund : fund,
    managing_body : managing_body
  };

  var getFundValueSql = getFundValueTemplate(data);

  return query(getFundValueSql);
}

function deleteFundValues(managing_body, report_year, report_quarter, fund, tableName){

  if (_.isEmpty(tableName) ){
    tableName = config.table;
  }

  var data = {
    tableName : tableName,
    report_year : report_year,
    report_quarter : report_quarter,
    fund : fund,
    managing_body : managing_body
  };

  var deleteFundValuesSql = deleteFundValuesTemplate(data);

  console.log(deleteFundValuesSql);

  return query(deleteFundValuesSql);
}


///copied form dal.js - postponing moving to common
/**
 * Add previous quarters to Squel query
 * @param query    : Squel select
 * @param year     : starting year
 * @param quarter  : starting quarter
 * @param numOfQuarters : number of previous quarters to add to query
 * @param callback : function to handle result rows
 */
function addLastQuartersToQuery(query, year, quarter, numOfQuarters){

    var expr=squel.expr();
    var quarters = 	getLastQuarters(year, quarter, numOfQuarters);
    for (var i = 0; i < quarters.length; i++){
        expr.or_begin()
            .and("report_year = "+ quarters[i]['year'])
            .and("report_qurater = " + quarters[i]['quarter'])
            .end();
    }

    query.where(expr);

    return query;
}

/**
 * Get previous quarters, including current, one based.
 * @param year : year to start counting back from
 * @param quarter : quarter to start counting back from
 * @return Array : [{'quarter':'1','year:'2012'}, ...]
 */
function getLastQuarters (year, quarter, numOfQuarters){
    if (quarter > 4){
        throw "illegal quarter";
    }

    var res = [];
    var q = quarter;
    for (var i = 0; i < numOfQuarters; i++) {

        var obj = {
            'quarter': ''+q,
            'year': ''+year,
            'str' : ''+ year + '_' + q
        };

        res.push(obj);

        if (q == 1){
            year--;
            q = 4;
        }
        else{
            q--;
        }

    };
    return res;
}


exports.query = query;
exports.createTable = createTable;
exports.emptyTable = emptyTable;
exports.defaultColumnsNamesMapping = defaultColumnsNamesMapping;
exports.columnsNames = columnsNames;
exports.deleteFundValues = deleteFundValues;
exports.getFundValue = getFundValue;
exports.addLastQuartersToQuery = addLastQuartersToQuery;


