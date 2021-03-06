var express = require('express');
var path = require('path');
var logger = require('morgan');
const multer = require("multer");
const storage = multer.memoryStorage();

// set up multer, only accept PDF, store in memory
const upload = multer({
  dest: "./temp/"
});

var app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const fs = require("fs")


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
// app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

const port = process.env.PORT || 3005

app.get('/', function(req, res, next) {
  res.render('index', { title: 'Buzzer' });
});


var rooms = new Map()

function getFile(filename) {
  return new Promise((resolve, reject) =>  {
    fs.readFile("./temp/" + filename, 'base64', (err, data) => {
      if (err) {
         reject(err)
      }
      resolve(data)
    })
  })
}

function deleteFile(filename) {
  fs.unlink("./temp/" + filename, (err) => {
    if (err) {
      throw err
    }
    console.log("file was deleted")
  })
}

try {
  io.on('connection', socket => {
    const socketID = socket.id
    socket.emit('join', 'Quiz Buzzer');
    // see what room has been joined
    socket.on("room", async (roomPayload) => {
      // join the room
      socket.join(roomPayload.room)

      // emit that someone has joined the room
      socket.to(roomPayload.room).emit('roomJoin', roomPayload.name)

      // create a list of users
      // find a room, if it doesn't exist. Create a new one
      try {
        if (rooms.has(roomPayload.room)) {
            rooms.set(roomPayload.room, [roomPayload.name, ...rooms.get(roomPayload.room)])
        } else {
          rooms.set(roomPayload.room, [roomPayload.name])
        }
        io.to(roomPayload.room).emit('roomUsers', rooms.get(roomPayload.room))
      } catch (error) {
        throw new Error(error)
      }

      // send the room count
      if (io.sockets.adapter.rooms[roomPayload.room]) {
        io.to(roomPayload.room).emit('roomCount', io.sockets.adapter.rooms[roomPayload.room].length)
      }

      // send the file to everyone
      socket.on("image", async (payload) => {
        const filename = payload.filename
          const file = await getFile(filename)
          io.to(roomPayload.room).binary(true).compress(true).emit('image', {
            type: payload.type, data: file}
          )
          deleteFile(filename)
      })

      socket.on("fileRecieved", () => {
        io.to(roomPayload.room).emit("fileRecieved")
      })

      socket.on("clearFileSrc", () => {
        io.to(roomPayload.room).emit("clearFileSrc")
      })

      // Send you result to everyone. 
      socket.on("submittedBy", (payload) => {
        // emit it to the rest of the room
        io.to(roomPayload.room).emit('submittedBy', payload)
      })

      socket.on("imageControl", (payload) => {
        io.to(roomPayload.room).emit('imageControl', payload)
      })

      // reset the fastest user table.
      socket.on("clear", () => {
        // emit it to the rest of the room
        io.to(roomPayload.room).emit('clear', true)
      })

      // on disconent, remove users and updated room count
      socket.on("disconnect", () => {
        io.to(socketID).emit('disconnet', "You have been disconnected");

        if (io.sockets.adapter.rooms[roomPayload.room]) {
          io.to(roomPayload.room).emit('roomCount', io.sockets.adapter.rooms[roomPayload.room].length)
        }
        if (rooms.has(roomPayload.room)) {
          let roomUsers = rooms.get(roomPayload.room)
          // delete a user when they disconnect
          rooms.set(roomPayload.name, roomUsers.splice(roomUsers.indexOf(roomPayload.name), 1))
          // emit the user list back to the room
          io.to(roomPayload.room).emit('roomUsers', rooms.get(roomPayload.room))
        }
      })
    })
  });
} catch (error) {
  console.error(error)
}

app.post("/stream", upload.single('data'), (req, res, next) => {
  const file = req.file
  res.send(file.filename)
})

server.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))

module.exports = app;
