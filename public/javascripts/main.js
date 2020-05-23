var socket = io(window.location.origin);

var app = new Vue({
    el: '#app',
    data: {
      inputMessage: "",
      users: [],
      welcome: "",
      selectedRoom: null,
      name: "",
      joined: "",
      choice: null,
      step: 1,
      roomName: "",
      roomCount: 0,
      fastestUser: [],
      submitted: false,
      error: false,
      userList: "",
      sounds: ["cartoon", "slip"],
      selectedSound: null,
      newArrival: [],
      timer: {
          message: "",
          time: ""
      },
      formErrors: {username: "", choice: "", roomname: ""},
      fileSrc: {data: "", mediaType: ""}, // file recieved from the server
      file: {name: ""} // file to be sent to everyone
    },
    methods: {
        validate() {
            let count = 0
            if (this.name === "" || this.name === null || this.name.length <= 0) {
                this.formErrors.username = "Please enter a name"
                count++
            }
            if (this.choice === "" || this.choice === null) {
                this.formErrors.choice = "Please select a choice"
                count++
            }
            // if (this.roomName == "" || this.roomName === null || !this.roomName) {
            //     this.formErrors.roomname = "Please type in a room name"
            //     count++
            // }
            if (count > 0 ) {
                return false
            } else {
                for (error in this.formErrors) {
                    this.formErrors[error] = null
                }
            }
            return true
        },
        // press the button
        answer() {
            if (this.submitted === false) {
                if (this.selectedSound && typeof this.selectedSound === "string") {
                    var sound = new Howl({
                        src: [`media/${this.selectedSound}.mp3`]
                      });
                    sound.play();
                }
                if (window.navigator.vibrate) {
                    window.navigator.vibrate(100)
                }
                socket.emit('submittedBy', this.name)
                this.submitted = true
            } else {
                this.error = "Already submitted your answer, please wait for the host to clear the scores"
            }
        },
        // join a room
        joinRoom() {
            if (this.validate()) {
                document.cookie = "name=" + this.name
                document.cookie = "host=join"
                document.cookie = "roomName=" + this.roomName
                socket.emit('room', {room: this.roomName, name: this.name, host: false})
                this.step = 2
            }
        },
        // set the room up as the host
        startRoom(roomName) {
            if (this.validate()) {
                this.roomName = roomName
                document.cookie = "name=" + this.name
                document.cookie = "host=host"
                document.cookie = "roomName=" + roomName
                socket.emit('room', {room: roomName, name: this.name, host: true})
                this.step = 2
            }
        },
        // clear the answers
        clear() {
            socket.emit('clear')
        },
        // show the countdown timer
        countDown(user) {
            let time = 5
            this.timer.message = user + " thinks they knows the answer, the countdown is on. "
            this.timer.time = time
            time --
            var x = setInterval(() => {
                this.timer.time = time
                time--
                if (time < 0) {
                    this.timer.message = 'Times up'
                    this.timer.time = 0
                    clearInterval(x)
                }
            }, 1000);
        },
        activeColor(key) {
            if (key === 0) {
                return "gold"
            }
            if (key === 1) {
                return "silver"
            }
            if (key === 2) {
                return "#b08d57"
            } 
        },
        sendFile(e) {
            e.preventDefault()
            socket.emit("image", this.file)
        },
        viewFile(e) {
            socket.emit("clearFileSrc")
            this.file.type = e.target.files[0].type
            this.file.data = e.target.files[0]
            this.file.name = e.target.files[0].name
        },
        playPause(value) {
            socket.emit('imageControl', value)
        },
        pauseImg(elm, mediaType) {
            if (mediaType === 'image') {
                elm.classList.remove('image-transform--play')
                elm.classList.add('image-transform--pause')
            }
            if (mediaType === 'video' || mediaType === 'audio') {
                const play = elm.play()
                if (play !== undefined) {
                    play.then(_ => {
                      elm.pause();
                    })
                    .catch(error => {
                      console.log(error)
                    });
                  }
            }
        },
        resumeImg(elm, mediaType) {
            if (mediaType === 'image') {
                elm.classList.remove('image-transform--pause')
                elm.classList.add('image-transform--play')
            }
            if (mediaType === 'video' || mediaType === 'audio') {
                elm.play()
            }
        }
    },
    computed: {
        socketID() {
            return socket.id
        },
        location() {
            return window.location.origin
        },
        randomName() {            
            let number = Math.floor(Math.random(9) * 10)
            for (let i = 0; i < 3; i++) {
                number += Math.floor(Math.random(9) * 10).toString()
            }
            return number
        }
    },
    created() {
        const cookies = new Map(document.cookie.split(";").map(c => {
            c = c.trim()
            return c.split("=")
        }))
        if (cookies.get("name")) {
            this.name = cookies.get("name")
        }
        if (cookies.get("host") === 'host' ) {
            this.choice = 'host'
        } else if (cookies.get("host") === 'join') {
            this.choice = 'join'
        }
        var urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has("room")) {
            this.roomName = urlParams.get("room")
            this.choice = 'join'
        }

        /***** start the socket functions ******/
        // send the buzzer click to socker
        socket.on('submittedBy', (user) => {
            this.fastestUser.push(user)
            const imgElm = this.$refs[this.fileSrc.mediaType]
            this.pauseImg(imgElm, this.fileSrc.mediaType)
            // if (this.fastestUser.length === 1) {
            //     this.countDown(this.fastestUser[0])
            // }
        })
        // on joining the room - send the title of the webpage
        socket.on('join', (msg) => {
            this.welcome = msg
        }),
        // on room join send push to array, clear it after 3 seconds. 
        socket.on('roomJoin', (user) => {
            this.newArrival.push(user)
            setTimeout(() => {
                this.newArrival.shift()
            }, 3000)
            this.users.push(user)
        })
        // how many people are in the room. 
        socket.on('roomCount', (count) => {
            this.roomCount = count
        })
        // reset the scores and other allow the buttons to be clicked again
        socket.on('clear', (clear) => {
            if (clear === true) {
                this.fastestUser = []
                this.submitted = false
                this.error = false
                this.timer = {message: "", time: ""}
            }
        }),
        // list of the users in the room
        socket.on('roomUsers', (userList) => {
            this.userList = userList
        })

        socket.on('image', (payload) => {
            const el = this.$refs
            if (payload.type.search(/video/i) >= 0) {
                this.fileSrc.mediaType = 'video'
            }
            if (payload.type.search(/audio/i) >= 0) {
                this.fileSrc.mediaType = 'audio'
            }
            if (payload.type.search(/image/i) >= 0) {
                this.fileSrc.mediaType = 'image'
            }
            // reset the image if it exists
            el.image.style.animation = 'none';
            el.image.offsetHeight; /* trigger reflow */
            el.image.style.animation = null;
            this.fileSrc.data = "data:" + payload.type + ";base64," + payload.data
        })

        socket.on('imageControl', (payload) => {
            const imgElm = this.$refs[this.fileSrc.mediaType]
            if (payload === 'play') {
                this.resumeImg(imgElm, this.fileSrc.mediaType)
            }
            if (payload === 'pause') {
                this.pauseImg(imgElm, this.fileSrc.mediaType)
            }
        })

        socket.on('clearFileSrc', () => {
            this.fileSrc.mediaType = ""
            this.fileSrc.data = ""
        })
    }
  })