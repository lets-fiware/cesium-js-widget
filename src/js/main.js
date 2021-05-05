/*
 * Cesium.js widget
 * https://github.com/lets-fiware/cesium-js-widget
 *
 * Copyright (c) 2021 Kazuhito Suda
 * Licensed under Apache-2.0 License
 */

import CesiumJs from './cesium-js';

(function () {
    "use strict";

    const parseInputEndpointData = function parseInputEndpointData(data) {
        if (data == null) {
            data = [];
        }

        if (typeof data === "string") {
            try {
                data = JSON.parse(data);
            } catch (e) {
                throw new MashupPlatform.wiring.EndpointTypeError();
            }
        } else if (typeof data !== "object") {
            throw new MashupPlatform.wiring.EndpointTypeError();
        }
        return data;
    };

    var cesiumjs = new CesiumJs();
    cesiumjs.init();

    MashupPlatform.wiring.registerCallback('layerInfo', (command_info) => {
        command_info = parseInputEndpointData(command_info);

        switch (command_info.action) {
        case "addLayer":
            cesiumjs.addLayer(command_info);
            break;
        case "moveLayer":
            cesiumjs.moveLayer(command_info);
            break;
        case "removeLayer":
            cesiumjs.removeLayer(command_info);
            break;
        case "setBaseLayer":
            cesiumjs.setBaseLayer(command_info);
            break;
        case "command":
            cesiumjs.command(command_info);
            break;
        default:
            throw new MashupPlatform.wiring.EndpointValueError();
        }
    });

    MashupPlatform.wiring.registerCallback('poiInput', (poi_info) => {
        poi_info = parseInputEndpointData(poi_info);

        if (!Array.isArray(poi_info)) {
            poi_info = [poi_info];
        }
        cesiumjs.registerPoIs(poi_info);
    });

    MashupPlatform.wiring.registerCallback('replacePoIs', (poi_info) => {
        poi_info = parseInputEndpointData(poi_info);

        if (!Array.isArray(poi_info)) {
            poi_info = [poi_info];
        }
        cesiumjs.replacePoIs(poi_info);
    });

    MashupPlatform.wiring.registerCallback('poiInputCenter', (poi_info) => {
        poi_info = parseInputEndpointData(poi_info);

        if (!Array.isArray(poi_info)) {
            poi_info = [poi_info];
        }

        cesiumjs.centerPoI(poi_info);
    });

    MashupPlatform.wiring.registerCallback('deletePoiInput', (poi_info) => {
        poi_info = parseInputEndpointData(poi_info);

        if (!Array.isArray(poi_info)) {
            poi_info = [poi_info];
        }
        cesiumjs.removePoIs(poi_info);
    });

    MashupPlatform.wiring.registerCallback('commnadInput', (commandList) => {
        cesiumjs.execCommands(commandList);
    });

})();
