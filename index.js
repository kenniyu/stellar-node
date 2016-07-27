var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var adminSocketId = "";
var clientsHash = {};   // maps email to socket id
var chatLogs = {};      // maps email to a list of message objects

var ADMIN_USERNAME = "Stellar Admin";

app.get('/', function(req, res){
  res.sendfile('index.html');
});

io.on('connection', function(socket) {
  console.log('a user connected');

  io.to(socket.id).emit('connectSuccess');

  socket.on('connectAdmin', function() {
    console.log("admin connected");
    adminSocketId = socket.id;

    // Notify admin of current users
    io.to(adminSocketId).emit('updateUsers', clientsHash);
  });

  socket.on('connectClient', function(email, photoUrl, firstName, lastName) {
    // Store email, socket.id KV
    clientsHash[email] = {
      'socketId': socket.id,
      'firstName': firstName,
      'lastName': lastName,
      'photoUrl': photoUrl,
      'connected': true
    };

    // Notify admin of current users
    io.to(adminSocketId).emit('connectClient', email);
    io.to(adminSocketId).emit('updateUsers', clientsHash);
    io.to(socket.id).emit('emailRegistered');
  });

  socket.on('disconnect', function() {
    var email = SocketManager.getEmailBySocketId(socket.id);
    SocketManager.setConnectionStatus(email, false);

    io.to(adminSocketId).emit('updateUsers', clientsHash);
  });

  socket.on('adminGetChat', function(email) {
    var clientChatLogs = chatLogs[email] || [];
    io.to(adminSocketId).emit('chatLogs', email, clientChatLogs);
  });

  socket.on('getClientChat', function() {
    var email = SocketManager.getEmailBySocketId(socket.id);
    clientChatLogs = chatLogs[email] || [];
    io.to(socket.id).emit('updateChatLogs', clientChatLogs);
  });



  socket.on('adminSendMessage', function(email, body) {
    var existingLogs = chatLogs[email] || [],
      clientSocketId = SocketManager.getSocketIdByEmail(email),
      message = {
        'email': ADMIN_USERNAME,
        'msgType': 'text',
        'body': body,
        'date': new Date(),
        'read': false
      };
    existingLogs.push(message);
    chatLogs[email] = existingLogs;

    io.to(adminSocketId).emit('chatLogs', email, chatLogs[email]);
    io.to(clientSocketId).emit('updateChatLogs', chatLogs[email]);
  });

  socket.on('adminTypingStarted', function(email) {
    var clientSocketId = SocketManager.getSocketIdByEmail(email);
    io.to(clientSocketId).emit('adminTypingStarted');
  });

  socket.on('adminTypingStopped', function(email) {
    var clientSocketId = SocketManager.getSocketIdByEmail(email);
    io.to(clientSocketId).emit('adminTypingStopped');
  });

  socket.on('clientTyping', function(isTyping) {
    var clientSocketId = socket.id,
      email = SocketManager.getEmailBySocketId(clientSocketId);
    io.to(adminSocketId).emit('clientTyping', email, isTyping);
  });

  socket.on('clientSendMessage', function(body) {
    var clientSocketId = socket.id,
      email = SocketManager.getEmailBySocketId(clientSocketId),
      existingLogs = chatLogs[email] || [],
      message = {
        'email': email,
        'msgType': 'text',
        'body': body,
        'date': new Date(),
        'read': false
      };
    existingLogs.push(message);
    chatLogs[email] = existingLogs;

    io.to(adminSocketId).emit('chatLogs', email, chatLogs[email]);
    io.to(clientSocketId).emit('updateChatLogs', chatLogs[email]);
  });

  socket.on('clientSendImage', function(base64Str) {
    var clientSocketId = socket.id,
      email = SocketManager.getEmailBySocketId(clientSocketId),
      existingLogs = chatLogs[email] || [],
      message = {
        'email': email,
        'msgType': 'image',
        'body': base64Str,
        'date': new Date(),
        'read': false
      };
    existingLogs.push(message);
    chatLogs[email] = existingLogs;

    io.to(adminSocketId).emit('chatLogs', email, chatLogs[email]);
    io.to(clientSocketId).emit('updateChatLogs', chatLogs[email]);
  });
});

http.listen(process.env.PORT || 5000, function() {
  console.log('listening on *:8000');
});

var SocketManager = {
  getSocketIdByEmail: function(targetEmail) {
    for (var email in clientsHash) {
      if (email === targetEmail) {
        return clientsHash[email].socketId;
      }
    }
  },

  getEmailBySocketId: function(socketId) {
    for (var email in clientsHash) {
      if (clientsHash[email].socketId === socketId) {
        return email;
      }
    }
  },

  setConnectionStatus: function(email, connected) {
    var client = clientsHash[email];
    if (client) {
      client.connected = connected;
    }
  }
}
