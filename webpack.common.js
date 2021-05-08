const path = require("path");

const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const cesiumBuild = 'node_modules/cesium/Build/Cesium';

const ConfigParser = require('wirecloud-config-parser');
const parser = new ConfigParser('src/config.xml');
const metadata = parser.getData();

module.exports = {
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
        fs: 'empty',
        Buffer: false,
        http: 'empty',
        https: 'empty',
        zlib: 'empty',
        net: 'empty',
        tls: 'empty',
    },
    resolve: {
        mainFields: ['module', 'main']
    },
    module: {
        unknownContextCritical: false,
        rules: [
            {
                test: /\.js$/,
                include: path.resolve(__dirname, 'src/js'),
                use: ['babel-loader']
            },
            {
                test: /\.css$/,
                include: [
                    path.resolve(__dirname, 'src/css'),
                    path.resolve(__dirname, 'node_modules/cesium/Build/Cesium/Widgets'),
                ],
                use: [MiniCssExtractPlugin.loader, 'css-loader']
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
                { from: path.join(cesiumBuild, 'ThirdParty'), to: 'ThirdParty' },
                { context: '', from: 'LICENSE', to: path.resolve(__dirname, 'build') },
                { context: 'src', from: '*', to: path.resolve(__dirname, 'build') },
                { context: 'src', from: 'doc/*', to: path.resolve(__dirname, 'build') },
                { context: 'src', from: 'images/*', to: path.resolve(__dirname, 'build') },
            ],
        }),
        new webpack.DefinePlugin({
            CESIUM_BASE_URL: JSON.stringify('/showcase/media/' + metadata.vendor + '/' + metadata.name + '/' + metadata.version + '/js')
        }),
        new MiniCssExtractPlugin({
            filename: '../css/style.css',
        }),
    ],
}
