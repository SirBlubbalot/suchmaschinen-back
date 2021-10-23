const express = require("express");
const app = express();

const ELS_IP = "http://node-1.hska.io:9200"
const ELS_INDEX= "rato1014_grmi1017_restaurants"

const {Client} = require('@elastic/elasticsearch')
const client = new Client({node: ELS_IP})


app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "http://localhost:3000"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({
    extended: true
}));

app.get("/", async (req, res, next) => {
    console.log("Request recieved" + JSON.stringify(req.query))

    const  body  = await client.search(buildQuery(req.query))
    res.json(body)
    console.log("Request answered: ", JSON.stringify(body))
})

app.listen(4000, () => {
    console.log("Server running on port 4000");
});

function buildQuery(params) {
    let request = {
        "index": ELS_INDEX,
        "size": 100,
        "body" : {
            "query": {
                "bool": {
                    "must": []
                }
            },
        }
    }
    params[1] = JSON.parse(params[1])
    console.log("Params: " + JSON.stringify(params))
    if(params) {
        if(params[1]) {

            params[1].map((filter) => (
                 request.body.query.bool.must.push({
                     "match": {
                         [filter[0]]: filter[1]
                     }
                 })

            ))

        }
        console.log(JSON.stringify(params[1]))
        if(params[0]) {
            request.body.query.bool.must.push({
                "multi_match": {
                    "query": params[0],
                    "fields": ["name", "addr:*"]
                }
            })
        }

    } else {
        request.body.query.bool.must = {"match_all": {}}
    }
    console.log("Query:" + JSON.stringify(request))
    return request
}
