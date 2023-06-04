const express = require('express');
const app = express();
const PORT = 8000
const bodyParser = require('body-parser');
// const router = express.router()

const mainRouter = require('./routes/routes');
const secretKey = 'your-secret-key';
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({  limit: '10mb', extended: true }));
// app.use(bodyParser.json());
app.use(mainRouter);
app.use((req, res) => {
    res.status(404).json({
        error: 'abe topaa hai kaa (bad request...)'
    })
})


app.listen(PORT, () => {
    console.log(`server start at ${PORT} port`);
})


