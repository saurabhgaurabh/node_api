const express = require('express');
const app = express();
const PORT = 8000
const bodyParser = require('body-parser');
// const router = express.router()
const mainRouter = require('./routes/routes');


app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(mainRouter);


app.listen(PORT, ()=>{
    console.log(`server start at ${PORT} port`);
})


