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
    const options = req.query
    const {body} = await client.search({
        index: ELS_INDEX,
        size:10000,
        // type: '_doc', // uncomment this line if you are using {es} ≤ 6
        body: {
            query: {
                match_all:{}
            }
        }
    })
    res.json({body})
})

app.listen(4000, () => {
    console.log("Server running on port 4000");
});
