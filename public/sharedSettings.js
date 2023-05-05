class SharedSettings {
    static get FIELD_WIDTH() {
        return 800;
    }
    static get FIELD_HEIGHT() {
        return 600;
    }
}

if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
    // サーバー処理（Node.js処理）用の記述
    module.exports = SharedSettings;
}
