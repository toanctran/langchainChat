import express from 'express';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import bodyParser from 'body-parser';

import { Server } from 'socket.io';

import OpenAI from 'openai';
const openaibot = new OpenAI({
  apiKey: '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',
});

const app = express();
const httpServer = createServer(app);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

app.post('/get_response', async (req, res) => {
  let data = req.body;
  let ChatCompletion = await openaibot.chat.completions.create({
    messages: [{ role: 'user', content: data.user_input }],
    model: 'gpt-3.5-turbo',
  });
  console.log(ChatCompletion.choices[0].message.content);
  res.send(ChatCompletion.choices[0].message.content);
});

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('A new client connected');

  // Handle socket events here
});

const host = '0.0.0.0'; // Change the host address here
const port = 3000;
httpServer.listen(port, host, () => {
  console.log(`Server is running at http://${host}:${port}`);
});
