
module.exports = {
  devtool: 'inline-source-map',
  entry: {
    bundle: './react',
  },

  module: {
    loaders: [{
      test: /\.jsx?$/,
      loader: 'babel?stage=0', // ?optional=runtime&stage=0',
    }],
  },

  output: {
    path: './build',
    filename: '[name].js',
  },

}

