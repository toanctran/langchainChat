const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const socketIO = require('socket.io');

const app = express();
const server = http.Server(app);
const io = socketIO(server);

app.get('/', (req, res) => {
  // Set the content type to HTML
  res.setHeader('Content-Type', 'text/html');

  // Read the index.html file
  fs.readFile(path.join(__dirname, 'template', 'index.html'), 'utf8', (err, data) => {
    if (err) {
      // If there was an error reading the file, send a 500 status code
      res.statusCode = 500;
      res.end('Internal Server Error');
    } else {
      // Send the contents of the index.html file as the response
      res.statusCode = 200;
      res.end(data);
    }
  });
});

io.on('connection', (socket) => {
  console.log('A new client connected');

  // Handle socket events here
});

const port = 3000;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
