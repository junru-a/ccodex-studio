const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  return {
    entry: './src/index.tsx',
    target: 'web',
    // Non-eval devtool to avoid CSP unsafe-eval violation
    devtool: isDev ? 'cheap-module-source-map' : 'source-map',
    output: {
      path: path.resolve(__dirname, 'dist-renderer'),
      filename: 'bundle.js',
      publicPath: '/',
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
      }),
    ],
    devServer: {
      port: 9000,
      hot: true,
      static: {
        directory: path.join(__dirname, 'public'),
      },
    },
  };
};
