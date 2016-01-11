var Promise = require('bluebird');
var fsep = require('fs-extra-promise');
var config = require('./config');
var throat = require('throat')
var path = require('path');
var fs = require('fs');
var logger = require('./logger');
var Utils = require('./utils');
var db = require('./db');
var CSVParser = Promise.promisify(require('json-2-csv').csv2json);
var elasticsearch = require('elasticsearch');
var client = new elasticsearch.Client({
    host: 'localhost:9200',
    log: 'trace',
    apiVersion: '2.1'
});



module.exports.importFilesCmd = function(parentDir, body, year, quarter, fund_number, tableName, concurrency){
    return fsep.readdirAsync(parentDir)
        .then(function(files) {

            files = Utils.filterFiles(files, body, year, quarter, fund_number);
            return module.exports.importFiles(parentDir, files, tableName, concurrency);
        })
        .then(function(res){
            fsep.writeFile("errors.log", res['errors']);
        })
        .catch(function(err){
            logger.error("error:" + err)
        })
}


module.exports.importFileCmd = function(filePath, tableName){

    var filename =  filePath.replace(/^.*(\\|\/|\:)/, '');
    var parentDir = filePath.substr(0, filePath.length - filename.length);

    //process.stdout.cursorTo (0);
    process.stdout.write("Importing: "+filename + "\n");

    return module.exports.importFile(parentDir, filename, tableName)
        .then(function(res){
            if (!res){
                logger.info("Not imported")
            }
            else{
                logger.info("Done importing.")
            }
        })
        .catch(function(err){
            logger.error("error:" +err);
        })
}



/**
 * Import files to db, concurrently --> resolves to
 *
 *
 * result['done'] = [filenames...]
 * result['errors'] = [filenames...]
 */
module.exports.importFiles = function(parentDir, files, tableName, concurrency){

    if ( concurrency == undefined) concurrency = 4;
    var total = files.length;
    var counter = 0;

    return Promise.all(files.map(throat(concurrency, function(filename){

            //process.stdout.cursorTo (0);
            process.stdout.write(++counter+'/'+total + ":"+ filename + "\n");

            if ( filename.substr(-4) !== '.csv' ){
                return;
            }

            return module.exports.importFile(parentDir, filename, tableName);

        })))
        .then(function(resArr){

            //resArr - array of booleans,
            //represents success/fail of corresponding file index

            var result = {}
            result['errors'] = [];
            result['done'] = [];

            for (i in resArr){
                if(resArr[i] === true){
                    result['done'].push(files[i]);
                }
                else if (resArr[i] === false){
                    result['errors'].push(files[i]);
                }
            }

            return result;
        });
}

//import file to elastic --> resolves to boolean
module.exports.importFile = function(parentDir, filename, tableName){

        var csvFilePath = path.join(parentDir, filename);

        if (!fs.existsSync(csvFilePath)){
            var absolutePath = path.resolve(csvFilePath);
            console.log("File not found " + absolutePath);
        }

        //Check if file already loaded to DB
        var year = filename.split('_')[1];
        var quarter = filename.split('_')[2];
        var fund = filename.split('_')[3].split('.')[0];
        var managing_body = filename.split('_')[0];

/*
    client.indices.create({
        index: 'production',
        body:{
            mappings: {
                "investment": {
                    "properties": {
                        "fair_value": {
                            "type": "double"
                        }
                    }
                }
            }
        }
        //body:{
        //    "properties": {
        //        "fair_value": {
        //            "type": "double"
        //        }
        //    }
        //}
    }).then(function(result){
        console.log("a"+JSON.stringify(result));
    }).catch(function(err){
        console.log("b"+JSON.stringify(err));
    });
*/

    /*
    //aggregate
    //select count(*),sum(fair_value),sum(market_cap),industry from production where report_year='2015' and report_qurater='1' and fund='8056' and managing_body='yl' group by industry
        client.search({
            index: 'production',
            body: {
                "query": {

                    "bool": {
                        "must": [
                            {"match": {"fund": fund}}
                        ]
                    }
                },
                "aggs":{
                    "industries":{
                        "terms":{
                            "field": "industry",
                            "size": "400"
                        },
                        "aggs":{
                          "value":{
                              "sum":{
                                  "field":"fair_value"
                              }
                          }
                        }
                    }

                }
            }
        }).then(function(result){
         console.log(JSON.stringify(result));
        });

        return;
*/

    client.count({
            index: 'production',
            body: {
                query: {
                    filtered: {
                        filter: {
                            and:[
                                    {
                                        term: {
                                            managing_body: managing_body
                                        }
                                    },
                                    {
                                        term: {
                                            report_year: year
                                        }
                                    },
                                    {
                                        term: {
                                            report_qurater: quarter
                                        }
                                    },
                                    {
                                        term: {
                                            fund: fund
                                        }
                                    }
                                ]
                        }
                    }
                }
            }
        })
        .then(function(response){

            return new Promise(function(resolve,reject){

                        var count = response.count;

                        if (count > 0){ //file in DB, skip file
                            logger.info([managing_body, year, quarter, fund].join("_") + " file already loaded to Elastic	")
                            resolve();
                            return;
                        }

                        //File not in DB, copy to table
                        var csvStr = fs.readFileSync(csvFilePath, "utf8");

                        return CSVParser(csvStr)
                            .then(function(data){

                                var body  = [];
                                for (var i = 0; i < data.length; i++){
                                    body.push({ index:  { _index: 'production', _type: 'investment' } });
                                    body.push(data[i]);
                                }

                                client.bulk({
                                    body: body
                                }, function (err, resp) {
                                    // ...
                                    //console.log(error)
                                    console.log(response)
                                });

                            });

                    });
            });

        //})
}

/*
 client.bulk({
 body: [
 // action description
 { index:  { _index: 'production', _type: 'investment' } },
 // the document to index
 { title: 'foo' }
 ]
 }, function (err, resp) {
 // ...
 });
*/
/*
client.bulk({
    body: [
        // action description
        { index:  { _index: 'production', _type: 'investment' } },
        // the document to index
        { title: 'foo' }
    ]
}, function (err, resp) {
    // ...
});
*/
/*

//delete by id
client.delete({
    index: 'production',
    type: 'investment',
    id: 'AVIKNciiwKZobl7ctZ3n'
}, function (error, response) {
    // ...
    console.log(error)
    console.log(response)
});
    */

/*
//delete index
client.indices.delete({
    index: 'production'
}, function (error, response) {
    // ...
    console.log(error)
    console.log(response)
});
*/

/*
 //set mapping
 client.indices.putMapping({
 index: 'production',
 type: 'investment',
 //body:{
 //    mappings: {
 //        "investment": {
 //            "properties": {
 //                "fair_value": {
 //                    "type": "double"
 //                }
 //            }
 //        }
 //    }
 //}
 body:{
 "properties": {
 "fair_value": {
 "type": "double"
 }
 }
 }
 }).then(function(result){
 console.log("a"+JSON.stringify(result));
 }).catch(function(err){
 console.log("b"+JSON.stringify(err));
 });

 return;
 */


var tableName = "pension_data_all";
var body = 'yl';
var year = '2015';
var quarter = '1';
var fund = '8056';

var sql = "SELECT * FROM "+ tableName +" WHERE managing_body='" +body +"'"
    + " AND report_year='"+year+"' AND report_qurater='"+quarter+"'"
    + " AND fund='"+fund+"' ";

console.log(sql);
var results = db.query(sql)
    .then(function(jsonData){

        var body  = [];
        for (var i = 0; i < jsonData.length; i++){
            body.push({ index:  { _index: 'production', _type: 'investment' } });
            body.push(jsonData[i]);
        }

        return client.bulk({
            body: body
        })
    })
    .then(function(result){
        console.log(result);
    })
    .catch(function(err){
        console.log(err);
    });
