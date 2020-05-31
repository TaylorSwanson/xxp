// Decodes packets and dispatches actions to message-handlers
// Doesn't matter if they come from a client or a server

const messageHeaders = require("./headers");

// Full message looks like this:

// 0xFF 0x00 0xFF 0x01 0x5F 0xAC (Start message)
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

  let currentBuffer = Buffer.alloc(0);
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
    currentBuffer = Buffer.alloc(0);
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
        console.log("Garbage at beginning of header");
        return resetStream();
      }
    }

    // Message has good start header

    // Check to see if we have header length info
    if (headerLength === 0) {
      // Read length of header
      if ((currentBuffer.length - startMessage.length) >= headerSizeBytes) {
        headerLength = currentBuffer.readUInt16BE(startMessage.length);
        
        if (headerLength === 0) {
          // No header size in packet
          console.log("No header size in packet");
          return resetStream();
        }
      }
    }

    // Check to see if we have content length info
    if (contentLength === 0) {
      // Read length of content
      if ((currentBuffer.length - startMessage.length - headerSizeBytes) >= contentSizeBytes) {
        contentLength = currentBuffer.readUInt32BE(startMessage.length + headerSizeBytes);

        if (contentLength === 0) {
          // No content size
          console.log("No content size");
          return resetStream();
        }
      }
    }

    // Get remaining buffer bytes for header and see if we have the whole header
    // If so then save it to the completeMessage
    const received = currentBuffer.length;

    // Byte offset of where to find header content:
    const headerStart = startMessage.length + headerSizeBytes + contentSizeBytes;

    const wasFullHeaderReceived = received >= (headerStart + headerLength);
    if (!wasFullHeaderReceived) return; // Waiting for more header

    const nextIndex = headerStart + headerLength;
    const nextBytes = currentBuffer.slice(nextIndex);

    if (nextBytes.length < startContent.length) return; // Waiting for more content

    // This should be the separator byte string
    const allegedSeparator = nextBytes.slice(0, startContent.length);
    const nextBytesHasContentSeparator = Buffer.compare(allegedSeparator, startContent) === 0;
    if (!nextBytesHasContentSeparator) {
      // The header/content separator wasn't there
      return resetStream();
    }

    // Separator has been passed, start reading content

    const contentStart = startMessage.length + headerSizeBytes + contentSizeBytes + headerLength + startContent.length;
    const contentReceived = received - contentStart;

    // const remainingBytes = nextBytes.length - startContent.length;
    const isContentPending = contentLength !== contentReceived;

    // Message complete
    // NOTE this makes streaming not possible
    if (!isContentPending) {
      // Must be the beginning of the next message if more comes through than stated
      // Cut out the remaining content and reset the buffer to contain the overflow data
      
      const headerData = currentBuffer.slice(headerStart, headerStart + headerLength);
      const contentData = currentBuffer.slice(contentStart, contentStart + contentLength);

      handlerCallback({ header: headerData, content: contentData, stream });
      
      // Prep for next message by adding extra data to new currentBuffer
      currentBuffer = currentBuffer.slice(contentStart + contentLength);
      hasHeader = false;
      headerLength = 0;
      contentLength = 0;
    }

  });
};
