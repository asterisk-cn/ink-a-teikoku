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
        this.color = obj.color;
    }
}

class Player extends GameObject {
    constructor(obj = {}) {
        super(obj);
        this.socketId = obj.socketId;
        this.name = obj.name;
        this.radius = 10;
        this.ready = false;
        this.isAlive = true;
    }

    toCircle() {
        return new sat.Circle(new sat.Vector(this.x, this.y), this.radius);
    }

    intersectPlayer(player) {
        return sat.testCircleCircle(this.toCircle(), player.toCircle());
    }

    intersectObstacles() {
        const obstacles = game.obstacles;
        return Object.values(obstacles).some((obstacle) => {
            return sat.testCirclePolygon(this.toCircle(), obstacle.toPolygon());
        });
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
}

const gameStatus = {
    winner: null,
};

const game = {
    players: {},
    obstacles: {},
    status: gameStatus,
};

// TODO
function resetObstacles() {
    const obstacles = {};
    for (let i = 0; i < 3; i++) {
        const width = 100;
        const height = 100;
        const obstacle = new Obstacle({
            x: Math.random() * (FIELD_WIDTH - width),
            y: Math.random() * (FIELD_HEIGHT - height),
            width: width,
            height: height,
            color: "#333333",
        });
        obstacles[obstacle.id] = obstacle;
    }
    game.obstacles = obstacles;
}

function reset() {
    resetObstacles();
    for (let id in game.players) {
        const player = game.players[id];
        player.x = null;
        player.y = null;
        player.radius = 10;
        player.ready = false;
        player.isAlive = true;
    }
    game.status.winner = null;
    io.emit("init", game);
}

io.on("connection", (socket) => {
    console.log("a user connected");
    const players = game.players;

    let player = null;
    const h = Math.random() * 360;
    player = new Player({
        socketId: socket.id,
        name: "player",
        color: `hsl(${h}, 80%, 60%)`,
        x: null,
        y: null,
        radius: 10,
    });
    players[socket.id] = player;

    if (Object.keys(players).length === 1) {
        resetObstacles();
    }

    socket.emit("init", game);

    socket.on("selectPoint", (p) => {
        const player = players[socket.id];
        if (player) {
            player.x = p.x;
            player.y = p.y;
        }
        player.ready = true;

        socket.emit("renderSelect", game, player.intersectObstacles());
    });

    socket.on("disconnect", () => {
        console.log("user disconnected");
        delete players[socket.id];
    });

    socket.on("showResult", () => {
        showResult();
    });

    socket.on("reset", () => {
        reset();
    });
});

function showResult() {
    const players = game.players;

    let timerId = setInterval(() => {
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

            // 他の円と衝突したら止める
            for (let j in players) {
                if (id == j) {
                    continue;
                }
                const _player = players[j];
                if (player.intersectPlayer(_player)) {
                    player.isAlive = false;
                }
            }

            // 障害物と衝突したら止める
            if (player.intersectObstacles()) {
                player.isAlive = false;
            }
        }

        const alivePlayers = Object.values(players).filter((p) => p.isAlive);
        if (alivePlayers.length === 1) {
            game.status.winner = alivePlayers[0];
        }

        io.emit("renderGame", game);

        // ゲーム終了判定
        if (alivePlayers.length === 0) {
            io.emit("gameOver", game);
            clearInterval(timerId);
        }
    }, 1000 / 60);
}

app.use(express.static("public"));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public/index.html"));
});

server.listen(3000, () => {
    console.log("Starting server on port 3000");
});
