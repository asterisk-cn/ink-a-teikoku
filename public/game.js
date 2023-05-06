"use strict";

const socket = io();

const canvas = document.getElementById("canvas");
canvas.width = SharedSettings.FIELD_WIDTH;
canvas.height = SharedSettings.FIELD_HEIGHT;

const showResultButton = document.getElementById("showResultButton");
const resetButton = document.getElementById("resetButton");

const context = canvas.getContext("2d");

let canClick = false;

socket.on("init", function (gameState) {
    const obstacles = gameState.obstacles;
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let id in obstacles) {
        const obstacle = obstacles[id];
        context.fillStyle = obstacle.color;
        context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }
    canClick = true;
});

canvas.addEventListener("mousedown", function (e) {
    if (!canClick) {
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    console.log("x: " + x + ", y: " + y);
    console.log("rect.left: " + rect.left + ", rect.top: " + rect.top);
    console.log("rect.right: " + rect.right + ", rect.bottom: " + rect.bottom);
    console.log("e.clientX: " + e.clientX + ", e.clientY: " + e.clientY);
    console.log("canvas.width: " + canvas.width + ", canvas.height: " + canvas.height);
    console.log(rect);

    socket.emit("selectPoint", { x: x, y: y });
});

socket.on("renderSelect", function (gameState, failure) {
    const players = gameState.players;
    const obstacles = gameState.obstacles;
    context.clearRect(0, 0, canvas.width, canvas.height);

    for (let id in obstacles) {
        const obstacle = obstacles[id];
        context.fillStyle = obstacle.color;
        context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }

    const player = players[socket.id];
    context.fillStyle = player.color;
    context.beginPath();
    context.arc(player.x, player.y, 5, 0, 2 * Math.PI);
    context.fill();

    if (failure) {
        alert("Colliding with an obstacle!");
    }
});

showResultButton.addEventListener("click", function () {
    canClick = false;
    socket.emit("showResult");
});

resetButton.addEventListener("click", function () {
    socket.emit("reset");
});

socket.on("renderGame", function (gameState) {
    render(gameState);
});

function render(gameState) {
    const players = gameState.players;
    const obstacles = gameState.obstacles;
    context.clearRect(0, 0, canvas.width, canvas.height);

    for (let id in obstacles) {
        const obstacle = obstacles[id];
        context.fillStyle = obstacle.color;
        context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }

    for (let id in players) {
        const player = players[id];
        const name = player.name;
        const fontSize = player.radius / 2;

        context.fillStyle = player.color;
        context.beginPath();
        context.arc(player.x, player.y, player.radius, 0, 2 * Math.PI);
        context.fill();

        context.fillStyle = "#333333";
        context.font = fontSize + "px sans-serif";
        context.textAlign = "center";
        context.fillText(name, player.x, player.y + fontSize / 3);
    }
}
