// db.js
const sqlite3 = require("sqlite3").verbose();

// Підключення до бази даних
const db = new sqlite3.Database("./database.db", (err) => {
    if (err) {
        console.error("Error connecting to database:", err);
    } else {
        console.log("Connected to SQLite database");
    }
});

module.exports = db;
