const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const CLIENT_DIR = path.join(__dirname, "..", "client");

// Ornek kullanici kaydi (gercek projede veritabanindan gelir).
const users = [
    { studentId: "230709074", password: "123456" },
    { studentId: "250709095", password: "abc123" }
];

const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png"
};

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { "Content-Type": contentTypes[".json"] });
    res.end(JSON.stringify(data));
}

function isValidStudentId(studentId) {
    return /^[0-9]{2}0709[0-9]{3}$/.test(studentId);
}

function safePath(urlPath) {
    const sanitized = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
    return path.join(CLIENT_DIR, sanitized);
}

function serveStatic(req, res) {
    let targetPath = req.url === "/" ? "/giriş.html" : req.url;
    targetPath = targetPath.split("?")[0];

    const filePath = safePath(targetPath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = contentTypes[ext] || "application/octet-stream";

    if (!filePath.startsWith(CLIENT_DIR)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404);
            res.end("Dosya bulunamadi");
            return;
        }

        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
    });
}

function handleLogin(req, res) {
    let body = "";

    req.on("data", (chunk) => {
        body += chunk.toString();
        if (body.length > 1e6) {
            req.socket.destroy();
        }
    });

    req.on("end", () => {
        let parsed;
        try {
            parsed = JSON.parse(body || "{}");
        } catch (error) {
            sendJson(res, 400, { message: "Gecersiz JSON verisi." });
            return;
        }

        const studentId = String(parsed.studentId || "").trim();
        const password = String(parsed.password || "");

        if (!studentId || !password) {
            sendJson(res, 400, { message: "Ogrenci ID ve sifre zorunludur." });
            return;
        }

        if (!isValidStudentId(studentId)) {
            sendJson(res, 400, { message: "Ogrenci ID formati hatali." });
            return;
        }

        const matchedUser = users.find(
            (user) => user.studentId === studentId && user.password === password
        );

        if (!matchedUser) {
            sendJson(res, 401, { message: "Ogrenci ID veya sifre yanlis." });
            return;
        }

        sendJson(res, 200, { message: "Giris basarili. Hos geldin!" });
    });
}

const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/api/login") {
        handleLogin(req, res);
        return;
    }

    if (req.method === "GET") {
        serveStatic(req, res);
        return;
    }

    sendJson(res, 405, { message: "Bu metot desteklenmiyor." });
});

server.listen(PORT, HOST, () => {
    console.log(`Sunucu calisiyor: http://${HOST}:${PORT}`);
});
