// Generates protocol packets

const crypto = require("crypto");

const messageHeaders = require("../../message-handlers/headers.js");


// Constant message headers for this protocol
// These values come in as buffers
const startMessage = messageHeaders.startMessage;
const startContent = messageHeaders.startContent;
const startStreamMessage = messageHeaders.startStreaming;

// Creates a packet that can be sent to any server or client
module.exports.newPacket = function({ content, header }) {
  // Header definitions are found in the host-server module
  // The 2 + 4 indicate 16 byte UInts and 32 byte UInts respectively
  content = JSON.stringify(content);

  if (!content.length) content = "";
  if (typeof header === "undefined" || typeof header !== "object") 
    header = {};

  // Attach a small amount of metadata
  // xxh is short for crisscrossheader
  // Metadata could be useful for later features
  const packetId = crypto.randomBytes(8).toString("hex");
  header["xxh__packetid"] = packetId;
  header["xxh__sendtime"] = Date.now();
  
  const headerJson = JSON.stringify(header);
  const contentJson = JSON.stringify(content);

  // Count size as buffers (not as string lengths, read: utf8 specials)
  const headerBuffer = Buffer.from(headerJson);
  const contentBuffer = Buffer.from(contentJson);

  const headerBufferLength = Buffer.byteLength(headerJson);
  const contentBufferLength = Buffer.byteLength(contentJson);

  const dataSize = contentBufferLength + headerBufferLength;
  let frameSize = startMessage.length;
  frameSize += startContent.length;
  frameSize += 2 + 4;
  const buf = Buffer.allocUnsafe(dataSize + frameSize);
  
  let idx = 0;
  // Write packet header
  let copied = startMessage.copy(buf, 0, 0);
  idx += copied;

  // Write header length
  buf.writeUInt16BE(headerBuffer.length, idx);
  idx += 2;

  // Write content length
  buf.writeUInt32BE(contentBuffer.length, idx);
  idx += 4;

  // Write header content bytes
  copied = headerBuffer.copy(buf, idx);
  idx += copied;

  // Write the start content header
  copied = startContent.copy(buf, idx);
  idx += copied;

  // Write the actual content
  copied = contentBuffer.copy(buf, idx);
  idx += copied;

  // console.log("Generated packet", buf.toString("utf8"));

  return {
    packet: buf,
    id: packetId
  };
};
