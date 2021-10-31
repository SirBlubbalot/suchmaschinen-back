const express = require("express");
const app = express();

const ELS_IP = "http://node-1.hska.io:9200"
const ELS_INDEX = "rato1014_grmi1017_restaurants"

const DEFAULT_LOC = [49.012923, 8.404327]
const DEFAULT_RESULT_NUM = 20
const DEFAULT_OPTIONS = {
    "cuisine": ["regional", "italian", "burger"]
}

const CHECKBOX_FILTER_MAPPING = {
    "wheelchair": {
        "match": {
            "wheelchair": "yes"
        }
    },
    "takeaway": {
        "match": {
            "takeaway": "yes"
        }
    },
    "website": {
        "exists": {
            "field": "website"
        }
    }
}
const {Client} = require('@elastic/elasticsearch')
const client = new Client({node: ELS_IP})


app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
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
    console.log(resData)
    const ret = {
        results: resData.body.hits.hits,
        scrollToken: resData.body._scroll_id
    }
    res.json(ret)
    //console.log("Request answered: ", JSON.stringify(ret))
})

app.post("/scroll", async (req, res) => {
    if (!req.body.scrollToken) {
        res.status(404);
        return;
    }
    console.log(req.body)
    const resData = await client.scroll({
        "scrollId": req.body.scrollToken,
        "scroll": "10m"
    })
    console.log(resData)
    const ret = {
        results: resData.body.hits.hits,
        scrollToken: resData.body._scroll_id
    }
    res.json(ret)
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
        "scroll": "10m",
        "body": {
            "sort": [
                {
                    "_geo_distance": {
                        "coordinates": [params.location["lng"], params.location["lat"]],
                        "order": "asc",
                        "unit": "km",
                        "mode": "min",
                        "distance_type": "plane",
                        "ignore_unmapped": true
                    }
                }
            ],
            "query": {
                "bool": {
                    "must": []
                }
            },
        }
    }
    if (!params.searchTerm && params.filtersSelection.cuisine === "") {
        request.body.query = {
            "match_all": {}
        }
    }

    if (params.filtersSelection.cuisine.length !== 0) {
        let filters = []
        Object.keys(params.filtersSelection).map((filter) => (
            params.filtersSelection[filter].map(value => {
                filters.push(
                    {
                        "match": {
                            [filter]: value
                        }
                    })
            })
        ))
        request.body.query.bool.must.push({
            "bool": {
                "should": filters,
                "minimum_should_match": 1
            }
        })
    }

    if (params.searchTerm) {
        request.body.query.bool.must.push({
            "multi_match": {
                "fuzziness": 3,
                "query": params.searchTerm,
                "fields": ["name", "addr:*"]
            }
        })
    }
    if (params.filterAmenity.length !== 0) {
        let amenityOptions = []
        params.filterAmenity.map((amenity) => {
            amenityOptions.push({
                "match": {
                    "amenity": amenity
                }
            })
        })
        request.body.query.bool.must.push({
            "bool": {
                "should": amenityOptions,
                "minimum_should_match": 1
            }
        })
    }

    if (params.filtersCheckbox.length !== 0) {

        let filters = []
        params.filtersCheckbox.map((filter) => {
                filters.push(CHECKBOX_FILTER_MAPPING[filter])
            }
        )
        request.body.query.bool.must.push({
            "bool": {
                "must": filters
            }
        })
    }

    console.log(JSON.stringify(request))
    return request
}
