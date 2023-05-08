"use strict";

import SharedSettings from "./sharedSettings.js";
const FIELD_WIDTH = SharedSettings.FIELD_WIDTH;
const FIELD_HEIGHT = SharedSettings.FIELD_HEIGHT;
const BLACK = "#333333";

const socket = io();

const canvas = $("canvas")[0];
canvas.width = FIELD_WIDTH;
canvas.height = FIELD_HEIGHT;
const context = canvas.getContext("2d");

let canClick = false;

$(window).on("load", function () {
    $("#modeSelectModal").modal("show");
});

$("#showResultButton").on("click", function () {
    canClick = false;
    socket.emit("showResult");
});

$("#resetButton").on("click", function () {
    socket.emit("reset");
});

function checkValidity(element) {
    const value = element.value;
    if (!value) {
        element.classList.add("is-invalid");
        return false;
    }
    element.classList.remove("is-invalid");
    return true;
}

$("#joinButton").on("click", function () {
    let valid = true;
    valid &= checkValidity(roomIdInput);
    valid &= checkValidity(nameInput);
    if (!valid) {
        return;
    }

    const roomId = roomIdInput.value;
    const name = nameInput.value;
    $("#modeSelectModal").modal("hide");
    $("#roomId").text(roomId);
    socket.emit("join", { roomId: roomId, name: name });
});

$("#vsComputerButton").on("click", function () {
    $("#modeSelectModal").modal("hide");
    $("#roomId").text("Computer");
    socket.emit("join", { roomId: null, name: "You" });
});

socket.on("init", function (game) {
    const obstacles = game.obstacles;
    context.clearRect(0, 0, canvas.width, canvas.height);
    renderObstacles(obstacles);

    canClick = true;
});

$("#canvas").on("click", function (e) {
    if (!canClick) {
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * FIELD_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * FIELD_HEIGHT;

    socket.emit("selectPoint", { x: x, y: y });
});

socket.on("readyPlayers", function (numReadyPlayers, numPlayers) {
    console.log(`Ready players: ${numReadyPlayers} / ${numPlayers}`);
    $("#readyPlayers").text(`${numReadyPlayers} / ${numPlayers}`);
});

socket.on("gameOver", function (game) {
    const winners = game.status.winners;
    const isWin = winners.some((winner) => {
        return winner.socketId === socket.id;
    });
    if (isWin) {
        $("#result").text("win!");
    } else {
        $("#result").text("lose...");
    }

    const text = winners
        .map((winner) => {
            return winner.name;
        })
        .join(", ");
    $("#winner").text(text);
    $("#resultModal").modal("show");
});

socket.on("renderSelect", function (game, isValidate) {
    const player = game.players[socket.id];
    const obstacles = game.obstacles;
    context.clearRect(0, 0, canvas.width, canvas.height);

    renderObstacles(obstacles);

    if (isValidate) {
        renderPlayer(player, false);
    } else {
        alert("Colliding with an obstacle!");
    }
});

socket.on("renderGame", function (game) {
    renderAll(game);
});

function renderObstacles(obstacles) {
    for (let id in obstacles) {
        const obstacle = obstacles[id];
        context.fillStyle = BLACK;
        context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }
}

function renderPlayer(player, renderName = true) {
    context.fillStyle = player.color;
    context.beginPath();
    context.arc(player.x, player.y, player.radius, 0, 2 * Math.PI);
    context.fill();

    if (!renderName) {
        return;
    }

    const name = player.name;
    const fontSize = player.radius / 2;

    context.fillStyle = BLACK;
    context.font = "bold " + fontSize + "px sans-serif";
    context.textAlign = "center";
    context.fillText(name, player.x, player.y + fontSize / 3);
}

function renderPlayers(players) {
    for (let id in players) {
        const player = players[id];
        if (!player.isReady) {
            continue;
        }
        renderPlayer(player);
    }
}

function renderAll(game) {
    const players = game.players;
    const obstacles = game.obstacles;
    context.clearRect(0, 0, canvas.width, canvas.height);

    renderObstacles(obstacles);
    renderPlayers(players);
}
