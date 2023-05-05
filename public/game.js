"use strict";

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: "arcade",
    },
    scene: {
        create: create,
    },
};

const socket = io();

const game = new Phaser.Game(config);
let circles = {};
let rects = [];
let canClick = true;
let graphics;
let winner = null;
let isGameStarted = false;
let isGameOver = false;

function create() {
    graphics = this.add.graphics();
    graphics.fillStyle(0xaaaaaa, 1);

    // //障害物
    // graphics.fillRect(100, 200, 200, 200);
    // rects.push(new Phaser.Geom.Rectangle(100, 200, 200, 200));

    this.input.on("pointerdown", function (pointer) {
        if (canClick) {
            socket.emit("position", { x: pointer.x, y: pointer.y });
            canClick = false; // クリック無効化
        }
    });

    socket.on("positions", function (positions) {
        for (let id in positions) {
            const position = positions[id];
            const circle = new Phaser.Geom.Circle(position.x, position.y, 0);
            circle.frozen = false;
            circles[id] = circle;
        }
        startGame();
    });
}

let animation;

function startGame() {
    animation = setInterval(update, 10);
}

function update() {
    for (let id in circles) {
        const circle = circles[id];
        if (circle.frozen) {
            continue;
        }

        circle.radius += 2;

        // 画面外に出たら止める
        let check_left = circle.x - circle.radius < 0;
        let check_right = circle.x + circle.radius > config["width"];
        let check_top = circle.y - circle.radius < 0;
        let check_bottom = circle.y + circle.radius > config["height"];
        if (check_left || check_right || check_top || check_bottom) {
            circle.frozen = true;
        }

        // 他の円と衝突したら止める
        for (let j in circles) {
            if (id == j) {
                continue;
            }
            const _circle = circles[j];
            if (Phaser.Geom.Intersects.CircleToCircle(circle, _circle)) {
                circle.frozen = true;
                _circle.frozen = true;
            }
        }

        // 障害物と衝突したら止める
        for (let i = 0; i < rects.length; i++) {
            const rect = rects[i];
            if (Phaser.Geom.Intersects.CircleToRectangle(circle, rect)) {
                circle.frozen = true;
            }
        }

        if (!circle.frozen) {
            winner = id;
            graphics.fillCircleShape(circle);
        }
    }

    // ゲーム終了判定
    let count = 0;
    for (let id in circles) {
        const circle = circles[id];
        if (circle.frozen) {
            count++;
        }
    }
    if (count == Object.keys(circles).length) {
        isGameOver = true;
    }

    if (isGameOver) {
        console.log("Winner: " + winner);
        if (winner == socket.id) {
            alert("You Win!");
        } else {
            alert("You Lose...");
        }
        clearInterval(animation);
    }
}
