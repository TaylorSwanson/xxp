# CrissCross Protocol (xxp)
This module is for the xxp definition, containing a node module for encoding
and decoding packets. This system is painfully simple and doesn't stream-read
packets except for over the TCP network buffer stream. A packet will come through as
an object to the receiver, not as a stream of data.

A future update could add this stream feature but CrissCross does not need it
at the moment

## Who this is for
This is for CrissCross apps to share a common protocol spec, though feel free
to use this protocol method for anything you'd like.

This API isn't stable for other projects. That's why this isn't in the npm
registry.

**Fork to use stabily and modify as you want**

## Handlers
A handler system needs to be built separately to work with different message
types. In the following examples, a handler already exists that uses the "type"
header in the packet.

## Usage examples
Assuming an output stream to another server and that the module is loaded:

### Send a random number to a remote server as a reply

```javascript
const num = Math.floor(Math.random() * (Number.MAX_SAFE_INTEGER - 1));

const packet = packetFactory.newPacket({
  header: {
    type: "network_reply_generic",
    "xxp__responseto": header["xxp__packetid"]
  },
  content: {
    number: num
  }
}).packet;

stream.write(packet);
```

### Listen to messages as a server
In this example, the `messageHandler` argument passed to the `packetDecoder` is
a function that accepts the arguments `({ header, content, stream })`.

```javascript
server = net.createServer(socket => {
  // This lets the server handle incoming messages with the message handlers
  packetDecoder(socket, messageHandler);

  socket.on("end", () => {
    // Lost connection, looks intentional (FIN packet sent)
    // We should have received a goodbye message so this shouldn't be an issue
  });

  socket.on("ready", () => {
    // Store reference to socket
    const address = socket.address();
    activeSockets[address.address] = socket;
  });
});

server.on("error", err => {
  throw err;
});

server.listen(port, () => {
  console.log(`Server bound to ${port}`);
});
```
