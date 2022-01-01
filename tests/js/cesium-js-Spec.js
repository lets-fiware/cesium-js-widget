/*
 * Cesium.js
 * https://github.com/lets-fiware/cesium-js-widget
 *
 * Copyright (c) 2021-2022 Kazuhito Suda
 * Licensed under Apache-2.0 License
 */

/* globals MashupPlatform, MockMP, maplibregl, Mapbox3DTiles, turf */

(function () {

    "use strict";

    describe("MapLibre", function () {

        var widget;

        beforeAll(function () {
            window.MashupPlatform = new MockMP({
                type: 'widget',
                prefs: {
                    'initialCenter': '',
                    'initialZoom': '6',
                    'initialPitch': '0',
                    'mapStyle': 'OSM',
                    'customStyle': '',
                    'minzoom': '4',
                    'maxzoom': '18',
                    'minpitch': '0',
                    'maxpitch': '60',
                    'navigationControl': 'off',
                    'geolocateControl': 'off',
                    'fullscreenControl': 'off',
                    'scaleControl': 'off',
                    'attributionControl': false,
                    'debug': false
                },
                inputs: ['layerInfo', 'poiInput', 'poiInputCenter', 'replacePoIs', 'deletePoiInput', 'commnadInput'],
                outputs: ['poiOutput', 'poiListOutput']
            });
        });

        beforeEach(function () {
            MashupPlatform.reset();
            MashupPlatform.prefs.set.calls.reset();
            widget = new MapLibre();
        });

        it("Dummy test", function () {
            expect(widget).not.toBe(null);
        });

    });

})();
