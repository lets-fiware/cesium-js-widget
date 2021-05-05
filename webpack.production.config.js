const path = require("path");

const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const cesiumBuild = 'node_modules/cesium/Build/Cesium';

const ConfigParser = require('wirecloud-config-parser');
const parser = new ConfigParser('src/config.xml');
const metadata = parser.getData();

module.exports = {
    mode: 'production',
    devtool: false,
    context: __dirname,
    entry: {
        main: './src/js/main.js'
    },
    output: {
        path: path.resolve(__dirname, 'build/js'),
        libraryTarget: 'umd',
        filename: '[name].js',
        chunkFilename: '[name].bundle.js',
        publicPath: '/showcase/media/' + metadata.vendor + '/' + metadata.name + '/' + metadata.version + '/js/',
        sourcePrefix: ''
    },
    amd: {
        toUrlUndefined: true
    },
    node: {
        fs: "empty",
        Buffer: false,
        http: "empty",
        https: "empty",
        zlib: "empty"
    },
    resolve: {
        mainFields: ['module', 'main']
    },
    module: {
        unknownContextCritical: false,
        rules: [
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.(png|gif|jpg|jpeg|svg|xml)$/,
                use: ['url-loader']
            },
        ]
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: path.join(cesiumBuild, 'Workers'), to: 'Workers' },
                { from: path.join(cesiumBuild, 'Assets'), to: 'Assets' },
                { from: path.join(cesiumBuild, 'Widgets'), to: 'Widgets' },
                { from: path.join(cesiumBuild, 'ThirdParty'), to: 'ThirdParty' }
            ],
        }),
        new webpack.DefinePlugin({
            CESIUM_BASE_URL: JSON.stringify('/showcase/media/' + metadata.vendor + '/' + metadata.name + '/' + metadata.version + '/js')
        })
    ],
    devServer: {
        contentBase: path.join(__dirname, 'build'),
        publicPath: '/js/',
        open: false,
        host: '0.0.0.0',
        port: 8080,
        hot: true,
        watchContentBase: true,
        inline: true
    }
}
