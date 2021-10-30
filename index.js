const express = require("express");
const app = express();

const ELS_IP = "http://node-1.hska.io:9200"
const ELS_INDEX = "rato1014_grmi1017_restaurants"

const DEFAULT_LOC = [49.012923, 8.404327]
const DEFAULT_RESULT_NUM = 20
const DEFAULT_OPTIONS = {
    "cuisine": ["regional", "italian", "burger"]
}

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
    const optionName = req.params.optionName || "wheelchair"
    const aggName = "option_query_" + optionName
    let ret = []
    const resData = await client.search(
        {
            "index": ELS_INDEX,
            "size": DEFAULT_RESULT_NUM,
            "body": {
                "aggs": {
                    [aggName]: {
                        "terms": {"field": optionName + ".keyword", "size": 10000}
                    }
                },
            }
        }
    ).then(result => {
        result.body.aggregations[aggName].buckets.map(bucket => {
            if (bucket.key.includes(';')) {
                ret.concat(bucket.key.split(';'))
            } else {
                ret.push(bucket.key)
            }
        })
        console.log(result.body.aggregations)
    }) || DEFAULT_OPTIONS[optionName]
    console.log(ret)
    res.json(ret)
})

app.post("/search", async (req, res) => {
    //console.log("Request recieved " + req.body)
    const resData = await client.search(buildQuery(req.body))
    res.json(resData)
    console.log("Request answered: ", resData)
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
    console.log(params)
    params.location = params.location || DEFAULT_LOC
    let request = {
        "index": ELS_INDEX,
        "size": DEFAULT_RESULT_NUM,
        "body": {
            "sort": [
                {
                    "_geo_distance": {
                        "pin.location": [params.location["lat"], params.location["lng"]],
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
                    "should": [],
                    "minimum_should_match": 1
                }
            },
        }
    }
    if (!params.searchTerm && params.filtersSelection.cuisine === "") {
        request.body.query = {
            "match_all": {}
        }
    }

    if (params.filtersSelection.cuisine !== "") {
        Object.keys(params.filtersSelection).map((filter) => (
            params.filtersSelection[filter].map(value => {
                request.body.query.bool.should.push(
                    {
                        "match": {
                            [filter]: value
                        }
                    })
            })
        ))
    }
    if (params.searchTerm) {
        request.body.query.bool.must = [{
            "multi_match": {
                "query": params.searchTerm,
                "fields": ["name", "addr:*"]
            }
        }]
    }
    console.log(JSON.stringify(request))
    return request
}
