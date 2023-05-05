"use strict";

const http = require("http");
const express = require("express");
const path = require("path");
const socketIO = require("socket.io");

const app = express();
const server = http.Server(app);
const io = socketIO(server);

let positions = {};

io.on("connection", (socket) => {
    console.log("a user connected");

    socket.on("position", (position) => {
        positions[socket.id] = position;
        if (Object.keys(positions).length === io.sockets.sockets.size) {
            io.emit("positions", positions);
        }
    });

    socket.on("disconnect", () => {
        console.log("user disconnected");
        delete positions[socket.id];
    });
});

app.use(express.static("public"));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

server.listen(3000, () => {
    console.log("Starting server on port 3000");
});
