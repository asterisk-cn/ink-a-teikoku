"use strict";

import express from "express";
import http from "http";
import { nanoid } from "nanoid";
import path from "path";
import sat from "sat";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

import SharedSettings from "./public/sharedSettings.js";
const FIELD_WIDTH = SharedSettings.FIELD_WIDTH;
const FIELD_HEIGHT = SharedSettings.FIELD_HEIGHT;

class GameObject {
    constructor(obj = {}) {
        this.id = nanoid();
        this.x = obj.x;
        this.y = obj.y;
    }
}

class Player extends GameObject {
    constructor(
        obj = {
            x: null,
            y: null,
        }
    ) {
        super(obj);
        this.socketId = obj.socketId;
        this.name = obj.name;
        this.roomId = obj.roomId || nanoid();
        this.color = `hsl(${Math.random() * 360}, 80%, 60%)`;

        this.radius = 3;
        this.isReady = false;
        this.isAlive = true;
        this.isBot = obj.isBot || false;
    }

    toCircle() {
        return new sat.Circle(new sat.Vector(this.x, this.y), this.radius);
    }

    intersectPlayer(player) {
        if (this.id === player.id) {
            return false;
        }
        if (!player.isReady) {
            return false;
        }
        return sat.testCircleCircle(this.toCircle(), player.toCircle());
    }

    intersectPlayers(players) {
        return Object.values(players).some((player) => {
            return this.intersectPlayer(player);
        });
    }

    intersectObstacles(obstacles) {
        return Object.values(obstacles).some((obstacle) => {
            return sat.testCirclePolygon(this.toCircle(), obstacle.toPolygon());
        });
    }

    intersect(game) {
        return this.intersectObstacles(game.obstacles) || this.intersectPlayers(game.players);
    }

    setRandom(game) {
        do {
            this.x = Math.random() * (FIELD_WIDTH - 100);
            this.y = Math.random() * (FIELD_HEIGHT - 100);
        } while (this.intersect(game));
        this.isReady = true;
    }

    reset() {
        this.x = null;
        this.y = null;
        this.radius = 3;
        this.isReady = false;
        this.isAlive = true;
    }
}

class Obstacle extends GameObject {
    constructor(obj = {}) {
        super(obj);
        this.width = obj.width;
        this.height = obj.height;
    }

    toPolygon() {
        return new sat.Box(new sat.Vector(this.x, this.y), this.width, this.height).toPolygon();
    }

    intersectObstacles(obstacles) {
        return Object.values(obstacles).some((obstacle) => {
            return sat.testPolygonPolygon(this.toPolygon(), obstacle.toPolygon());
        });
    }

    static random(game) {
        let obstacle;
        do {
            obstacle = new Obstacle({
                x: Math.random() * (FIELD_WIDTH - 100),
                y: Math.random() * (FIELD_HEIGHT - 100),
                width: 100,
                height: 100,
            });
        } while (obstacle.intersectObstacles(game.obstacles));
        return obstacle;
    }
}

class Game {
    constructor(roomId) {
        this.players = {};
        this.obstacles = {};
        this.status = {
            winners: [],
            isTie: false,
        };
        this.roomId = roomId;

        this.setRandomObstacles(3);
    }

    get alivePlayers() {
        return Object.values(this.players).filter((player) => player.isAlive);
    }

    get isAllReady() {
        return Object.values(this.players).every((player) => player.isReady);
    }

    get isGameOver() {
        return this.alivePlayers.length === 0;
    }

    get numReadyActualPlayers() {
        return Object.values(this.players).filter((player) => player.isReady && !player.isBot).length;
    }

    get numActualPlayers() {
        return Object.values(this.players).filter((player) => !player.isBot).length;
    }

    checkWinner() {
        const alivePlayers = this.alivePlayers;
        if (alivePlayers.length === 0) {
            return;
        }
        this.status.winners = alivePlayers;
        if (alivePlayers.length === 1) {
            this.status.isTie = false;
        } else if (alivePlayers.length > 1) {
            this.status.isTie = true;
        }
    }

    setRandomObstacles(n) {
        const obstacles = (this.obstacles = {});
        for (let i = 0; i < n; i++) {
            const obstacle = Obstacle.random(this);
            obstacles[obstacle.id] = obstacle;
        }
    }

    reset() {
        this.setRandomObstacles(3);
        for (let id in this.players) {
            const player = this.players[id];
            player.reset();
            if (player.isBot) {
                player.setRandom(this);
            }
        }
        this.status.winners = [];
        this.status.isTie = false;
    }

    isEmpty() {
        return Object.keys(this.players).length === 0;
    }

    showResult() {
        let timerId = setInterval(() => {
            const players = this.players;
            for (let id in players) {
                const player = players[id];
                if (!player.isAlive) {
                    continue;
                }

                player.radius += 2;

                // 画面外に出たら止める
                const check_left = player.x - player.radius < 0;
                const check_right = player.x + player.radius > FIELD_WIDTH;
                const check_top = player.y - player.radius < 0;
                const check_bottom = player.y + player.radius > FIELD_HEIGHT;
                if (check_left || check_right || check_top || check_bottom) {
                    player.isAlive = false;
                }

                if (player.intersect(this)) {
                    player.isAlive = false;
                }
            }

            this.checkWinner();

            io.in(this.roomId).emit("renderGame", this);

            // ゲーム終了判定
            if (this.isGameOver) {
                io.in(this.roomId).emit("gameOver", this);
                clearInterval(timerId);
            }
        }, 1000 / 60);
    }
}

const rooms = {};
const users = [];

function validateUser(socket) {
    const isValid = users.some((user) => user.socketId === socket.id);
    if (!isValid) {
        console.log("user " + socket.id + " is not valid");
        socket.emit("init");
    }
    return isValid;
}

function validateRoom(socket, roomId) {
    const isValid = Object.keys(rooms).includes(roomId);
    if (!isValid) {
        console.log("room " + roomId + " is not valid");
        socket.emit("init");
    }
    return isValid;
}

io.on("connection", (socket) => {
    console.log(socket.id + " connected");
    socket.emit("init");

    socket.on("join", (playerData) => {
        const player = new Player({
            socketId: socket.id,
            name: playerData.name,
            roomId: playerData.roomId,
        });

        if (rooms[player.roomId] === undefined) {
            rooms[player.roomId] = new Game(player.roomId);
        }

        const game = rooms[player.roomId];

        const players = game.players;
        players[socket.id] = player;
        users.push(player);

        if (playerData.roomId === null) {
            for (let i = 0; i < 3; i++) {
                const bot = new Player({
                    socketId: nanoid(),
                    name: "Bot " + (i + 1),
                    roomId: player.roomId,
                    isBot: true,
                });
                bot.setRandom(game);
                players[bot.socketId] = bot;
            }
        }

        socket.join(player.roomId);

        socket.emit("initGame", game);
        io.in(player.roomId).emit("readyPlayers", game.numReadyActualPlayers, game.numActualPlayers);

        console.log(`Player ${player.name} joined room ${player.roomId}`);
    });

    socket.on("selectPoint", (p) => {
        if (!validateUser(socket)) {
            return;
        }
        const user = users.find((u) => u.socketId === socket.id);
        if (!validateRoom(socket, user.roomId)) {
            return;
        }
        const game = rooms[user.roomId];
        const player = game.players[socket.id];
        if (player) {
            player.x = p.x;
            player.y = p.y;
        }

        const obstacles = Object.values(game.obstacles);
        const isValidate = !player.intersectObstacles(obstacles);
        player.isReady = isValidate;

        if (player.isReady) {
            console.log(`Player ${player.name} is ready!`);
        }

        socket.emit("renderSelect", game, isValidate);
        io.in(user.roomId).emit("readyPlayers", game.numReadyActualPlayers, game.numActualPlayers);
    });

    socket.on("showResult", () => {
        if (!validateUser(socket)) {
            return;
        }
        const user = users.find((u) => u.socketId === socket.id);
        if (!validateRoom(socket, user.roomId)) {
            return;
        }
        const game = rooms[user.roomId];
        game.showResult();
    });

    socket.on("reset", () => {
        if (!validateUser(socket)) {
            return;
        }
        const user = users.find((u) => u.socketId === socket.id);
        if (!validateRoom(socket, user.roomId)) {
            return;
        }
        const game = rooms[user.roomId];
        game.reset();
        io.in(user.roomId).emit("initGame", game);
        io.in(user.roomId).emit("readyPlayers", game.numReadyActualPlayers, game.numActualPlayers);
    });

    socket.on("disconnect", () => {
        console.log(socket.id + " disconnected");
        if (!validateUser(socket)) {
            return;
        }
        const user = users.find((u) => u.socketId === socket.id);
        if (!validateRoom(socket, user.roomId)) {
            return;
        }
        const game = rooms[user.roomId];

        delete game.players[socket.id];
        if (game.isEmpty()) {
            delete rooms[user.roomId];
        }

        users.splice(users.indexOf(user), 1);
    });
});

app.use(express.static("public"));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

server.listen(3000, () => {
    console.log("Starting server on port 3000");
});
