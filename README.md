# Cesium.js widget

[![](https://nexus.lab.fiware.org/repository/raw/public/badges/chapters/visualization.svg)](https://www.fiware.org/developers/catalogue/)
[![License: Apache-2.0](https://img.shields.io/github/license/lets-fiware/cesium-js-widget.svg)](https://opensource.org/licenses/Apache-2.0)<br/>
![Build](https://github.com/lets-fiware/cesium-js-widget/workflows/Build/badge.svg)
![GitHub all releases](https://img.shields.io/github/downloads/lets-fiware/cesium-js-widget/total)

This is a map viewer widget uses Cesium.js. It can receive Layers or Point of Interest data and display them on the map.

Build
-----

Be sure to have installed [Node.js](http://node.js) in your system. For example, you can install it on Ubuntu and Debian running the following commands:

```bash
curl -sL https://deb.nodesource.com/setup | sudo bash -
sudo apt-get install nodejs
sudo apt-get install npm
```

Install other npm dependencies by running:

```bash
npm install
```

In order to build this widget, you need to download grunt:

```bash
sudo npm install -g grunt-cli
```

And now, you can use grunt:

```bash
npm run build
```

If everything goes well, you will find a wgt file in the `dist` folder.

## Documentation

Documentation about how to use this widget is available on the
[User Guide](src/doc/userguide.md). Anyway, you can find general information
about how to use widgets on the
[WireCloud's User Guide](https://wirecloud.readthedocs.io/en/stable/user_guide/)
available on Read the Docs.

## Third party libraries

The Cesium.js widget makes use of the following libraries:

| Libraries                                             | OSS License          |
| ----------------------------------------------------- | -------------------- |
| [CesiumGS/cesium](https://github.com/CesiumGS/cesium) | Apache-2.0 License   |
| [Turfjs/turf](https://github.com/Turfjs/turf)         | MIT License          |

The dependencies of dependencies have been omitted from the list.

## Copyright and License

Copyright (c) 2021 Kazuhito Suda<br>
Licensed under the [Apache-2.0 License](./LICENSE).
