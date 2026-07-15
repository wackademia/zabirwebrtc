var http = require('http');
var fs = require('fs');
var path = require('path');
var socketIO = require('socket.io');
require('dotenv').config();

var PORT = process.env.PORT || 8181;

var MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.ico': 'image/x-icon'
};

// Serves js/turn-config.js dynamically from env vars (see PDF guide).
function serveTurnConfig(res) {
    var appName = process.env.METERED_APP_NAME || '';
    var apiKey = process.env.METERED_API_KEY || '';
    var body = 'var METERED_APP_NAME = ' + JSON.stringify(appName) + ';\n' +
        'var METERED_API_KEY = ' + JSON.stringify(apiKey) + ';\n';
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(body);
}

function serveStaticFile(req, res) {
    var urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';

    var safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    var filePath = path.join(__dirname, safePath);

    fs.readFile(filePath, function (err, data) {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
        }
        var contentType = MIME_TYPES[path.extname(filePath)] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

var app = http.createServer(function (req, res) {
    if (req.url === '/js/turn-config.js') {
        serveTurnConfig(res);
        return;
    }
    serveStaticFile(req, res);
}).listen(PORT);

console.log('Signaling server listening on port ' + PORT);

var io = socketIO(app);

io.on('connection', function (socket) {

    socket.on('create or join', function (room) {
        var roomClients = io.sockets.adapter.rooms.get(room);
        var numClients = roomClients ? roomClients.size : 0;

        if (numClients === 0) {
            socket.join(room);
            socket.emit('created', room);
        } else if (numClients === 1) {
            socket.join(room);
            socket.emit('joined', room);
            socket.to(room).emit('ready');
        } else {
            socket.emit('full', room);
        }
    });

    socket.on('message', function (data) {
        socket.to(data.room).emit('message', data.payload);
    });

    socket.on('bye', function (room) {
        socket.to(room).emit('bye');
        socket.leave(room);
    });

    socket.on('disconnect', function () {
        console.log('Client disconnected: ' + socket.id);
    });
});
