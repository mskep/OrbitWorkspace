const downloader = require('./downloader');

module.exports = {
  download: async (payload) => {
    return downloader.downloadVideo(payload);
  },

  getInfo: async (payload) => {
    return downloader.getVideoInfo(payload);
  }
};
