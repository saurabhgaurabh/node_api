const mysql = require('mysql');

const connection = mysql.createConnection({
    host: 'localhost',
    // port: 3308,
    database: 'myapp_db',
    user: 'root',
    password: '12345678',
});

module.exports = connection;  // to accessable this connection in to another file.
