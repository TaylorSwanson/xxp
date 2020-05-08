// Headers for encoding/decoding message sent over network between servers
// These are arbitrary an are used in the decoder/encoder automatically
// They must be exported as buffers, this also marginally increases performance
module.exports = {
  startMessage: Buffer.from([0xFF, 0x00, 0xF1, 0x01, 0x5F, 0xAC]),
  startContent: Buffer.from([0xFF, 0x00, 0xF1, 0x02, 0x6F, 0xAD]),
  // Not currently used:
  startStreaming: Buffer.from([0xFF, 0x00, 0xF1, 0x03, 0xAF, 0xAE])
};
