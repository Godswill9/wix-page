require("dotenv").config();
const express = require("express");
const http = require("http");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const server = http.createServer(app);
const payments = require("./routes/payments");
const bookings = require("./routes/bookings");

app.use(express.static('build'));
app.use(
  cors({
    origin:"*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    // allowedHeaders: ["Content-Type", "Authorization"], // Ensure necessary headers are allowed
  })
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static("public"));


// Routes for the API
app.get("/", (req, res) => {
  res.send("welcome to wix backend system...");
});
app.use("/api/payments", payments);
app.use("/api/bookings", bookings);



// Set the port to listen on
const port = process.env.PORT || 8092;
console.log(new Date());

// Start the server with WebSocket
server.listen(port, () => {
  console.log("Server is running on port", port);
});