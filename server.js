var http = require('http');
var fs = require('fs');
var path = require('path');
var socketIO = require('socket.io');
require('dotenv').config(); // loads .env locally; no-op if the file doesn't exist (e.g. on Render)

var PORT = process.env.PORT || 8181;

var MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.ico': 'image/x-icon'
};

// Builds js/turn-config.js on the fly from environment variables, instead
// of it being a committed file with the Metered secret key baked in.
// Locally: set METERED_APP_NAME / METERED_API_KEY in a .env file (gitignored).
// On Render: set the same two variables under the service's Environment tab.
function serveTurnConfig(res) {
    var appName = process.env.METERED_APP_NAME || '';
    var apiKey = process.env.METERED_API_KEY || '';
    var body = 'var METERED_APP_NAME = ' + JSON.stringify(appName) + ';\n' +
        'var METERED_API_KEY = ' + JSON.stringify(apiKey) + ';\n';
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(body);
}

// Minimal static file server for index.html / js/client.js (replaces the
// old node-static dependency, which crashes on newer Node versions with a
// "Cannot write headers after they are sent" error under socket.io).
function serveStaticFile(req, res) {
    var urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';

    // Keep requests confined to this project folder.
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
