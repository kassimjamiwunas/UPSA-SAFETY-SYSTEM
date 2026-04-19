const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "", // Your MySQL password
  database: "upsa_safety_system"
});

db.connect(err => {
  if (err) console.error("Database connection failed:", err);
  else console.log("Database connected");
});

module.exports = db;