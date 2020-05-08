// Decodes packets and dispatches actions to message-handlers
// Doesn't matter if they come from a client or a server

const messageHeaders = require("./headers");

// Full message looks like this:

// 0xFF 0x00 0xFF 0x01 0x5F (Start message)
// 2 bytes header size unsigned (0-65535 bytes)
// 4 bytes content size unsigned
// Header bytes compressed JSON (must be set, at least {})
// 0xFF 0x00 0xFF 0x02 0x6F (Start content)
// Content bytes compressed JSON

// done


// Constant message headers for this protocol
// These values come in as buffers
const startMessage = messageHeaders.startMessage;
const startContent = messageHeaders.startContent;
const startStreamMessage = messageHeaders.startStreaming;

// For quantized packets
const headerSizeBytes = 2;  // Number of bytes to represent the length of header
const contentSizeBytes = 4; // Number of bytes to represent length of content

// Pass a string to the decoder and it will continuously deconstruct packets
// handlerCallback should be defined as a function that takes the arguments for
// each packet that is received { header, content, stream }

// Handling of the stream must be done externally of this function, and this
// function shouldn't care about that (will discard unfinished messages)
module.exports = function(stream, handlerCallback) {
  if (!handlerCallback || typeof handlerCallback != "function")
    return console.error("Cannot have a packet decoder with no handler");

  let currentBuffer = Buffer.allocUnsafe(0);
  let hasHeader = false;
  let headerLength = 0;
  let contentLength = 0;

  function resetStream() {
    console.log("Stream was reset because the message was damaged");
    console.log(currentBuffer).toString("base64");

    // Reset and throw everything away
    hasHeader = false;
    headerLength = 0;
    contentLength = 0;
    currentBuffer = Buffer.allocUnsafe(0);
  }

  stream.on("data", message => {
    // Build up message
    currentBuffer = Buffer.concat([currentBuffer, message]);

    // Check if we've received a whole header yet
    if (!hasHeader && currentBuffer.length >= startMessage.length) {
      // Check header content
      const receivedHeader = currentBuffer.slice(0, startMessage.length);
      hasHeader = Buffer.compare(startMessage, receivedHeader) === 0;

      if (!hasHeader) {
        // Looks like we've read some garbage at the beginning of this message
        // reset and throw away data
        return resetStream();
      }
    }

    // Message has good start header

    // Check to see if we have header length info
    if (headerLength === 0) {
      // Read length of header
      if ((currentBuffer.length - startMessage.length) >= headerSizeBytes) {
        headerLength = bufHeaderLength.readUInt16BE(startMessage.length);

        if (headerLength === 0) {
          // No header size in packet
          return resetStream();
        }
      }
    }

    // Check to see if we have content length info
    if (contentLength === 0) {
      // Read length of content
      if ((currentBuffer.length - startMessage.length - headerSizeBytes) >= contentSizeBytes) {
        contentLength = bufcontentLength.readUInt32BE(startMessage.length + headerSizeBytes);

        if (contentLength === 0) {
          // No content size
          return resetStream();
        }
      }
    }

    // Get remaining buffer bytes for header and see if we have the whole header
    // If so then save it to the completeMessage
    const received = currentBuffer.length;

    const headerStart = startMessage.length + headerSizeBytes + contentSizeBytes;
    // Amount of bytes received already for the header
    const headerReceived = received - headerStart;
    // Amount of header bytes not yet received
    const headerPending = headerLength - headerReceived;

    if (headerPending !== 0) return; // Waiting for more header

    const nextIndex = startMessage.length + headerSizeBytes + contentSizeBytes + headerLength;
    const nextBytes = currentBuffer.slice(nextIndex);

    if (nextBytes.length < startContent.length) return; // Waiting for more content

    const nextBytesHasContentSeparator = Buffer.compare(nextBytes.slice(0, startContent.length), startContent) === 0;
    if (!nextBytesHasContentSeparator) {
      // The header/content separator wasn't there
      return resetStream();
    }

    const contentStart = startMessage.length + headerSizeBytes + contentSizeBytes + headerLength + startContent.length;
    const contentReceived = received - contentStart;
    const contentPending = contentLength - contentReceived;

    // Message complete
    // NOTE this makes streaming not possible
    if (contentPending <= 0) {
      // Must be the beginning of the next message if more comes through than stated
      // Cut out the remaining content and reset the buffer to contain the overflow data
      
      const header = currentBuffer.slice(headerStart, headerLength);
      const content = currentBuffer.slice(contentStart, contentLength);

      handlerCallback({ header, content, stream });
      
      // Prep for next message by adding extra data to new currentBuffer
      currentBuffer = currentBuffer.slice(contentStart + contentLength);
      hasHeader = false;
      headerLength = 0;
      contentLength = 0;
    }

  });
};
