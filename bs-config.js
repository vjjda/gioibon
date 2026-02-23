module.exports = {
    "server": {
        "baseDir": "web",
        "routes": {
            "/node_modules": "node_modules"
        },
        "middleware": function (req, res, next) {
            if (req.url.endsWith('.wasm')) {
                res.setHeader('Content-Type', 'application/wasm');
            }
            next();
        }
    },
    "serveStatic": ["web/public"],
    "files": ["web/**/*"],
    "port": 3456,
    "notify": false,
    "ui": false,
    "open": false
};
