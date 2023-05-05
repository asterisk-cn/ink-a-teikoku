const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: "arcade",
    },
    scene: {
        preload: preload,
        create: create,
        update: update,
    },
};

const socket = io();

const game = new Phaser.Game(config);
let circles = {};
let rects = [];
let canClick = true;
let graphics;
let stop = {};

function preload() {}

function create() {
    graphics = this.add.graphics();
    graphics.fillStyle(0xaaaaaa, 1);
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
            position = positions[id];
            const circle = new Phaser.Geom.Circle(position.x, position.y, 0);
            circle.frozen = false;
            circles[id] = circle;
        }
    });
}

function update() {
    for (let id in circles) {
        const circle = circles[id];
        if (circle.frozen) {
            continue;
        }

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
                break;
            }
        }

        // 障害物と衝突したら止める
        for (let i = 0; i < rects.length; i++) {
            const rect = rects[i];
            if (Phaser.Geom.Intersects.CircleToRectangle(circle, rect)) {
                circle.frozen = true;
                break;
            }
        }
        circle.radius += 2;
        graphics.fillCircleShape(circle);
    }
}

// // 座標を受信して円を表示する
// socket.on("positions", function (positions) {
//     startTime = Date.now();
//     // 円を描画する
//     graphics.lineStyle(2, 0xffffff);
//     Object.values(positions).forEach(function (position) {
//         // 円の半径を徐々に増加させる
//         const radius = (Math.min(Date.now() - startTime, 1000) / 1000) * 50;
//         graphics.strokeCircle(position.x, position.y, radius);
//     });
// });
