import * as http from 'http';
import * as express from 'express';
import { Request, Response, NextFunction } from 'express-serve-static-core';
import * as url from 'url';
import * as fs from "fs";
import * as cp from 'child_process';
import ChannelsManager from './ChannelsManager';
import SocketChannel from './SocketChannel';
import { ParsedUrlQuery } from "querystring";
import * as io from 'socket.io';
import { prepareExecutable, PORT } from './config';
import ProcessManager from "./ProcessManager";
const app = express();

const server = http.createServer(app);

app.all("*", function(req: Request, res: Response, next: NextFunction) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type,Content-Length, Authorization, Accept,X-Requested-With"
  );
  res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  res.header("X-Powered-By", " 3.2.1");
  if (req.method == "OPTIONS") res.send(200);
  else next();
});


app.get("/content", (req: Request, res: Response) => {
  const urlPart: url.UrlWithParsedQuery = url.parse(req.url, true);
  const queryString: ParsedUrlQuery = urlPart.query;
  const { ws, file } = queryString;
  fs.readFile(`${ws}${file}`, (err: NodeJS.ErrnoException, data: Buffer) => {
    if (err) {
      console.log(err.message);
    }
    res.send({
      data: data.toString(),
      code: 0
    });
  });
});

const socket = io(server);

export const channelsManager = new ChannelsManager();
export const processManager = new ProcessManager();

socket.on('connection', (websocket: io.Socket) => {
  const urlPart = url.parse(websocket.request.url, true)
  const { ws } = urlPart.query
  if (!channelsManager.hasWs(<string>ws)) {
    const rooms: Array<any> = Object.keys(websocket.rooms)
    const processCommand = prepareExecutable();
    const newArgs = [
      '-data',
      `/data/coding-ide-home/lsp-workspace/${ws}`
    ];
    console.log(`[LSP-DATA]: ${newArgs.join(' ')}`);
    try {
      const childprocess = cp.spawn(processCommand.command, [...processCommand.args, ...newArgs]);
      processManager.addProcess({ spacekey: <string>ws, process: childprocess });
      const socketChannel = new SocketChannel(<string>ws, childprocess);
      socketChannel.join(websocket);
      channelsManager.add(socketChannel);
    } catch(err) {
      console.log(err.message);
    }
  } else {
    console.log(`${ws} is ready`);
  }
});

socket.on('error', (err) => {
  console.log(err.message);
});

server.listen(PORT, () => {
  console.log('Web Server start in 9988 port!');
});

process.on('uncaughtException', function(err) {
  console.log(err.stack);
});

process.on('exit', () => {
  processManager.killAll();
});
