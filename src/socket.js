let io = null;

module.exports = {
  setIo: (ioInstance) => { io = ioInstance; },
  getIo: () => io
};