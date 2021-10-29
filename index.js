const express = require("express");
const app = express();

const ELS_IP = "http://node-1.hska.io:9200"
const ELS_INDEX = "rato1014_grmi1017_restaurants"

const DEFAULT_LOC = [49.012923, 8.404327]
const DEFAULT_RESULT_NUM = 20

const {Client} = require('@elastic/elasticsearch')
const client = new Client({node: ELS_IP})


app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "http://localhost:3000"); // update to match the domain you will make the request from
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
const bodyParser = require("body-parser");
app.use(bodyParser.json({
    extended: true
}));

app.get("/options/:optionName", async (req, res) => {
    const resData = await client.search({
        //TODO: Options query
    })
    res.json(resData)
})

app.post("/search", async (req, res) => {
    console.log("Request recieved " + JSON.stringify(req.body))
    const resData = await client.search(buildQuery(req.body))
    res.json(resData)
    console.log("Request answered: ", JSON.stringify(resData))
})

app.post("/scroll", async (req, res) => {
    if (!req.query.scrollToken) {
        res.status(404);
        return;
    }
    const resData = await client.search({
        //TODO: scroll query
    })
    res.json(resData)
})


app.listen(4000, () => {
    console.log("Server running on port 4000");
});

function buildQuery(params) {
    params.location = params.location || DEFAULT_LOC
    let request = {
        "index": ELS_INDEX,
        "size": DEFAULT_RESULT_NUM,
        "body": {
            "sort": [
                {
                    "_geo_distance": {
                        "pin.location": params.location,
                        "order": "asc",
                        "unit": "km",
                        "mode": "min",
                        "distance_type": "arc",
                        "ignore_unmapped": true
                    }
                }
            ],
            "query": {
                "bool": {
                    "must": [],
                    "filter": []
                }
            },
        }
    }


    if (params.filtersSelection) {
        params.filtersSelection.entries().map((key, value) => (
            request.body.query.bool.filter.push({
                "match": {
                    key: value
                }
            })

        ))

    }
    if (params.searchTerm) {
        request.body.query.bool.must.push({
            "multi_match": {
                "query": params[0],
                "fields": ["name", "addr:*"]
            }
        })
    }
    return request
}
