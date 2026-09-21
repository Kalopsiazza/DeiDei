module.exports = {
  packagerConfig: {
    asar: true,
    extraResource: ['dist/worker'],
    ignore: [/^\/(?!package\.json$|main\.cjs$|preload\.cjs$|bridge\.cjs$|profile\.cjs$|build(?:\/|$))/,
      /^\/build\/(?!ui(?:\/|$))/]
  },
  makers: []
};
