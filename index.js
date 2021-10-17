const express = require("express");
const app = express();

const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({
    extended: true
}));


app.get("/", (req, res, next) => {
    res.json({test: "successful"})
})

app.listen(3000, () => {
    console.log("Server running on port 3000");
});
