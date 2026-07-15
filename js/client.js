var localVideo = document.getElementById('localVideo');
var remoteVideo = document.getElementById('remoteVideo');
var roomInput = document.getElementById('roomInput');
var joinButton = document.getElementById('joinButton');
var hangupButton = document.getElementById('hangupButton');
var logDiv = document.getElementById('log');

var localStream;
var peerConnection;
var room;
var isInitiator = false;

// STUN-only fallback until loadTurnCredentials() resolves (see PDF guide).
var rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

function loadTurnCredentials() {
    if (!METERED_APP_NAME || !METERED_API_KEY) {
        log('No TURN credentials configured - using STUN only.');
        return Promise.resolve();
    }
    var url = 'https://' + METERED_APP_NAME +
        '.metered.live/api/v1/turn/credentials?apiKey=' + METERED_API_KEY;

    return fetch(url)
        .then(function (response) { return response.json(); })
        .then(function (data) {
            var iceServers = Array.isArray(data) ? data
                : Array.isArray(data && data.iceServers) ? data.iceServers
                : null;

            if (!iceServers) {
                log('TURN response was not a valid iceServers array, falling back ' +
                    'to STUN only. Raw response: ' + JSON.stringify(data));
                return;
            }
            rtcConfig.iceServers = iceServers;
            log('TURN credentials loaded (' + iceServers.length + ' ICE servers).');
        })
        .catch(function (error) {
            log('Failed to load TURN credentials, falling back to STUN only: ' + error);
        });
}

var turnReady = loadTurnCredentials();

var socket = io.connect();

function log(text) {
    console.log(text);
    logDiv.insertAdjacentHTML('beforeend', '<p>' + text + '</p>');
}

joinButton.onclick = function () {
    room = roomInput.value.trim();
    if (!room) { alert('Enter a room name first.'); return; }

    turnReady
        .then(function () {
            return navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        })
        .then(function (stream) {
            localStream = stream;
            localVideo.srcObject = stream;
            joinButton.disabled = true;
            socket.emit('create or join', room);
        })
        .catch(function (error) {
            log('getUserMedia error: ' + error);
        });
};

socket.on('created', function () {
    isInitiator = true;
    log('Room created. Waiting for someone to join...');
});

socket.on('joined', function () {
    isInitiator = false;
    log('Joined existing room.');
});

socket.on('full', function () {
    log('That room already has two people in it. Try another name.');
});

socket.on('ready', function () {
    log('Peer connected. Starting call...');
    try {
        startPeerConnection();
        if (isInitiator) createOffer();
    } catch (error) {
        log('Failed to start the call: ' + error);
    }
});

socket.on('message', function (payload) {
    if (!peerConnection) {
        try {
            startPeerConnection();
        } catch (error) {
            log('Failed to start the call: ' + error);
            return;
        }
    }

    if (payload.type === 'offer') {
        peerConnection.setRemoteDescription(new RTCSessionDescription(payload))
            .then(function () { return peerConnection.createAnswer(); })
            .then(function (answer) { return peerConnection.setLocalDescription(answer); })
            .then(function () {
                sendMessage({ type: 'answer', sdp: peerConnection.localDescription.sdp });
            });
    } else if (payload.type === 'answer') {
        peerConnection.setRemoteDescription(new RTCSessionDescription(payload));
    } else if (payload.type === 'candidate') {
        peerConnection.addIceCandidate(new RTCIceCandidate({
            sdpMLineIndex: payload.label,
            sdpMid: payload.id,
            candidate: payload.candidate
        }));
    }
});

socket.on('bye', function () {
    log('Remote peer hung up.');
    hangup();
});

hangupButton.onclick = function () {
    socket.emit('bye', room);
    hangup();
};

function startPeerConnection() {
    try {
        peerConnection = new RTCPeerConnection(rtcConfig);
    } catch (error) {
        log('RTCPeerConnection failed with current ICE config (' + error +
            '), retrying with STUN only.');
        peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    }

    peerConnection.onicecandidate = function (event) {
        if (event.candidate) {
            sendMessage({
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate
            });
        }
    };

    peerConnection.ontrack = function (event) {
        remoteVideo.srcObject = event.streams[0];
    };

    localStream.getTracks().forEach(function (track) {
        peerConnection.addTrack(track, localStream);
    });

    hangupButton.disabled = false;
}

function createOffer() {
    peerConnection.createOffer()
        .then(function (offer) { return peerConnection.setLocalDescription(offer); })
        .then(function () {
            sendMessage({ type: 'offer', sdp: peerConnection.localDescription.sdp });
        });
}

function sendMessage(payload) {
    socket.emit('message', { room: room, payload: payload });
}

function hangup() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    remoteVideo.srcObject = null;
    hangupButton.disabled = true;
    joinButton.disabled = false;
}
