/*
 * Cesium.js widget
 * https://github.com/lets-fiware/cesium-js-widget
 *
 * Copyright (c) 2021-2024 Kazuhito Suda
 * Licensed under Apache-2.0 License
 */

/* globals MashupPlatform */

import {
    Cartesian3,
    Cesium3DTileStyle,
    Cesium3DTileset,
    Color,
    Credit,
    CustomDataSource,
    Ellipsoid,
    HeadingPitchRange,
    Ion,
    Math,
    OpenStreetMapImageryProvider,
    PinBuilder,
    Rectangle,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    Transforms,
    VerticalOrigin,
    Viewer,
} from 'cesium';

import "../css/styles.css";
import "cesium/Build/Cesium/Widgets/widgets.css";
import * as turf from '@turf/turf';
import { JapanGSITerrainProvider, JapanGSIImageryProvider } from '@lets-fiware/cesium-japangsi';

"use strict";

export default function CesiumJs() {
    this.pois = {};
    this.queue = [];
    this.executingCmd = '';
    this.waiting = false;
    this.debug = MashupPlatform.prefs.get('debug');

    MashupPlatform.prefs.registerCallback(function (new_preferences) {
    }.bind(this));
};

const TITLE_MAP_STYLES = {
    OSM: {
        title: 'Open Street Map',
        attributions: '© <a href="http://osm.org/copyright">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
        url: 'https://tile.openstreetmap.org/'
    },
    GSI_STD: {
        title: 'GSI STD',
        attributions: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">Geospatial Information Authority of Japan Tile</a>',
        url: "https://cyberjapandata.gsi.go.jp/xyz/std/",
        minZoomLevel: 2,
        maxZoomLevel: 18,
    },
    GSI_PALE: {
        title: 'GSI PALE',
        attributions: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">Geospatial Information Authority of Japan Tile</a>',
        url: '//cyberjapandata.gsi.go.jp/xyz/pale/',
        minZoomLevel: 5,
        maxZoomLevel: 18,
    },
    GSI_ENG: {
        title: 'GSI ENGLISH',
        attributions: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">Geospatial Information Authority of Japan Tile</a>',
        url: '//cyberjapandata.gsi.go.jp/xyz/english/',
        minZoomLevel: 5,
        maxZoomLevel: 11,
    },
    GSI_BLANK: {
        title: 'GSI BLANK',
        attributions: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">Geospatial Information Authority of Japan Tile</a>',
        url: '//cyberjapandata.gsi.go.jp/xyz/blank/',
        minZoomLevel: 5,
        maxZoomLevel: 14,
    },
    GSI_RELIEF: {
        title: 'GSI RELIEF',
        attributions: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">Geospatial Information Authority of Japan Tile</a>',
        url: '//cyberjapandata.gsi.go.jp/xyz/relief/',
        minZoomLevel: 5,
        maxZoomLevel: 15,
    },
};

CesiumJs.prototype.init = function init() {
    let initialPosition = MashupPlatform.prefs.get('initialPosition').split(',').map(Number);
    if (initialPosition.length != 3
        || !Number.isFinite(initialPosition[0])
        || !Number.isFinite(initialPosition[1])
        || !Number.isFinite(initialPosition[2])) {
        if (MashupPlatform.context.get('language') == 'ja') {
            initialPosition = [138, 30, 3000000];
        } else {
            initialPosition = [0 ,35, 3000000];
        }
    }

    let initialOrientation = MashupPlatform.prefs.get('initialOrientation').split(',').map(Number);
    if (initialOrientation.length != 3
        || !Number.isFinite(initialOrientation[0])
        || !Number.isFinite(initialOrientation[1])
        || !Number.isFinite(initialOrientation[2])) {
        initialOrientation = [0, -1.3, 0];
    }

    Ion.defaultAccessToken = MashupPlatform.prefs.get('token');

    const options = {
        animation: MashupPlatform.prefs.get('animation'),
        baseLayerPicker: MashupPlatform.prefs.get('baseLayerPicker'),
        fullscreenButton: MashupPlatform.prefs.get('fullscreenButton'),
        geocoder: MashupPlatform.prefs.get('geocoder'),
        homeButton: MashupPlatform.prefs.get('homeButton'),
        timeline: MashupPlatform.prefs.get('timeline'),
        navigationHelpButton: MashupPlatform.prefs.get('navigationHelpButton'),
        sceneModePicker: MashupPlatform.prefs.get('sceneModePicker'),
    }

    const style = MashupPlatform.prefs.get('mapStyle');
    if (style != 'OFF') {
        const raster_tile = new OpenStreetMapImageryProvider({
            url: TITLE_MAP_STYLES[style].url,
            credit: new Credit(TITLE_MAP_STYLES[style].attributions, true),
            maximumLevel: 18,
        });
        options.imageryProvider = raster_tile;
    }

    this.viewer = new Viewer("cesiumContainer", options)

    this.viewer.camera.setView({
        destination: Cartesian3.fromDegrees(initialPosition[0], initialPosition[1], initialPosition[2]),
        orientation: {
            heading: initialOrientation[0],
            pitch: initialOrientation[1],
            roll: initialOrientation[2]
        }
    });

    this.pinBuilder = new PinBuilder();
    this.scratchRectangle = new Rectangle();

    this.intervalHandler = setInterval(() => {
        if (this.isMoving) {
            sendPoIList.call(this);
        }
    }, 100)

    this.isMoving = false;

    this.viewer.camera.moveStart.addEventListener(() => {
        this.isMoving = true;
    });
    this.viewer.camera.moveEnd.addEventListener(() => {
        this.isMoving = false;
    });

    this.screenSpaceEventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
    // sendSelectedPoI
    this.screenSpaceEventHandler.setInputAction(e => {
        if (MashupPlatform.widget.outputs.poiOutput.connected) {
            const picked = this.viewer.scene.pick(e.position);
            if (picked) {
                const feature = this.pois[picked.id.id];
                if (feature) {
                    MashupPlatform.widget.outputs.poiOutput.pushEvent(feature);
                } else {
                    const feature = this.pois[picked.id.entityCollection.owner.name];
                    if (feature) {
                        MashupPlatform.widget.outputs.poiOutput.pushEvent(feature);
                    }
                }
            }
        }
    },
    ScreenSpaceEventType.LEFT_CLICK
    );

    // Porting of https://github.com/Wirecloud/ol3-map-widget
    // Set position button
    const setposition_button = document.getElementById('setposition-button');
    setposition_button.addEventListener('click', (event) => {
        const pos = this.viewer.camera.position;
        const carto = Ellipsoid.WGS84.cartesianToCartographic(pos);
        const long = Math.toDegrees(carto.longitude);
        const lat = Math.toDegrees(carto.latitude);
        MashupPlatform.prefs.set(
            'initialPosition',
            long + ', ' + lat + ', ' + carto.height
        );
    });
    const setorientation_button = document.getElementById('setorientation-button');
    setorientation_button.addEventListener('click', (event) => {
        MashupPlatform.prefs.set(
            'initialOrientation',
            this.viewer.camera.heading + ', ' + this.viewer.camera.pitch + ', ' + this.viewer.camera.roll
        );
    });
    const setlocation_button = document.getElementById('setlocaton-button');
    setlocation_button.addEventListener('click', (event) => {
        const pos = this.viewer.camera.position;
        const carto = Ellipsoid.WGS84.cartesianToCartographic(pos);
        const long = Math.toDegrees(carto.longitude);
        const lat = Math.toDegrees(carto.latitude);
        MashupPlatform.prefs.set(
            'initialPosition',
            long + ', ' + lat + ', ' + carto.height
        );
        MashupPlatform.prefs.set(
            'initialOrientation',
            this.viewer.camera.heading + ', ' + this.viewer.camera.pitch + ', ' + this.viewer.camera.roll
        )
    });
    const update_ui_buttons = (changes) => {
        // Use strict equality as changes can not contains changes on the
        // editing parameter
        if (changes.editing === true) {
            setposition_button.classList.remove('hidden');
            setorientation_button.classList.remove('hidden');
            setlocation_button.classList.remove('hidden');
        } else if (changes.editing === false) {
            setposition_button.classList.add('hidden');
            setorientation_button.classList.add('hidden');
            setlocation_button.classList.add('hidden');
        }
    };
    MashupPlatform.mashup.context.registerCallback(update_ui_buttons);
    update_ui_buttons({editing: MashupPlatform.mashup.context.get('editing')});

    // Create a table mapping class name to unicode.
    this.glyphTable = {};
    this.get_styleSheets = function get_styleSheets() {
        return window.top.document.styleSheets;
    }
    let found = false;
    const styleSheets = this.get_styleSheets();
    for (let i = 0; i < styleSheets.length; i++) {
        const sheet = styleSheets[i];
        if (sheet && !found) {
            const before = '::before';
            for (let j = 0; j < sheet.cssRules.length; j++) {
                const cssRule = sheet.cssRules[j];
                if (cssRule.selectorText && cssRule.selectorText.startsWith('.fa') && cssRule.selectorText.endsWith(before)) {
                    const ctx = String.fromCodePoint(cssRule.style.content.replace(/'|"/g, '').charCodeAt(0));
                    this.glyphTable[cssRule.selectorText.slice(1).slice(0, -1 * before.length)] = ctx;
                    found = true;
                }
            }
        }
    }
    this.faMarkerCache = {};
}

CesiumJs.prototype.addLayer = function addLayer(command_info) {
    // Not yet implemented
}

CesiumJs.prototype.moveLayer = function moveLayer(command_info) {
    // Not yet implemented
}

CesiumJs.prototype.removeLayer = function removeLayer(command_info) {
    // Not yet implemented
}

CesiumJs.prototype.setBaseLayer = function setBaseLayer(command_info) {
    // Not yet implemented
}

CesiumJs.prototype.registerPoIs = function registerPoIs(pois_info) {
    pois_info.forEach(poi => registerPoI.call(this, poi, true));
    sendPoIList.call(this);
}

CesiumJs.prototype.replacePoIs = function replacePoIs(pois_info) {
    this.viewer.entities.removeAll();
    this.pois = {};

    pois_info.forEach(poi => registerPoI.call(this, poi, false));
    sendPoIList.call(this);
}

CesiumJs.prototype.centerPoI = function centerPoI(poi_info) {
    const features = poi_info.map(poi => registerPoI.call(this, poi, true));
    if (poi_info.length > 1 || (poi_info.length == 1 && poi_info[0].location.type != 'Point')) {
        const box = turf.envelope(turf.featureCollection(features)).bbox;
        const rect = new Rectangle();
        Rectangle.fromDegrees(box[0], box[1], box[2], box[3], rect);
        this.viewer.camera.flyTo({
            destination: rect
        });
    } else {
        this.viewer.flyTo(this.viewer.entities.getById(poi_info[0].id));
    }
    sendPoIList.call(this);
}

CesiumJs.prototype.removePoIs = function removePoIs(pois_info) {
    pois_info.forEach(poi => {
        removePoi.call(this, poi);
        delete this.pois[poi.id];
    });
    sendPoIList.call(this);
}

const registerPoI = function registerPoI(poi, update) {
    removePoi.call(this, poi);
    if (!poi.data) {
        poi.data = {};
    }
    const style = (poi.style) ? poi.style : {}
    if (!style.fontSymbol) {
        style.fontSymbol = {}
    }
    if (!style.fill) {
        style.fill = {}
    }
    switch (poi.location.type) {
    case 'Point':
        this.viewer.entities.add(buildPoint.call(this, poi, style));
        break;
    case 'MultiPoint':
        this.viewer.dataSources.add(buildMultiPoint.call(this, poi, style));
        break;
    case 'LineString':
        this.viewer.entities.add(buildLineString(poi, style))
        break;
    case 'MultiLineString':
        this.viewer.dataSources.add(buildMultiLineString(poi, style));
        break;
    case 'Polygon':
        this.viewer.entities.add(buildPolygon(poi, style))
        break;
    case 'MultiPolygon':
        this.viewer.dataSources.add(buildMultiPolygon(poi, style));
        break;
    default:
        MashupPlatform.widget.log(`Unknown type: ${poi.location.type}, id: ${poi.id}`, MashupPlatform.log.INFO);
        return;
    }
    this.pois[poi.id] = poi;

    return getFeature(poi);
}

const removePoi = function removePoi(poi) {
    if (!this.pois[poi.id]) {
        return;
    }
    const e = this.viewer.entities.getById(poi.id);
    if (e != null) {
        this.viewer.entities.remove(e);
    } else {
        const e = this.viewer.dataSources.getByName(poi.id)
        if (e != null) {
            this.viewer.dataSources.remove(e[0], true);
        }
    }
}

const fontAwesomeIcon = function fontAwesomeIcon(fontSymbol) {
    const glyph = fontSymbol.glyph || 'fa-star';
    let form = fontSymbol.form || 'marker';
    const size = fontSymbol.size || 16;
    const fill = fontSymbol.fill || 'blue';
    const stroke = fontSymbol.stroke || 'white';
    let color = fontSymbol.color || stroke;
    const strokeWidth = fontSymbol.strokeWidth || 3;
    const margin = fontSymbol.margin || 0.4;
    const radius = fontSymbol.radius || (size / 2) + strokeWidth + size * margin;
    const unicode = this.glyphTable[glyph];
    if (typeof unicode === 'undefined') {
        form = '';
    }

    const hash = glyph + form + size + fill + stroke + color + strokeWidth + radius + unicode;
    if (hash in this.faMarkerCache) {
        return this.faMarkerCache[hash];
    }

    const canvas = window.top.document.createElement('canvas');
    canvas.width  = radius * 2;
    canvas.height = radius * 2;

    const context = canvas.getContext('2d');

    switch (form) {
    case 'icon':
        const size2 = size + strokeWidth * 2;
        context.font = `600 ${size2}px "Font Awesome 5 Free"`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = stroke;
        context.fillText(unicode, radius, radius);
        if (stroke == color) {
            color = fill;
        }
        break;
    case 'circle':
        context.arc(radius, radius , radius - strokeWidth - 0.5, 0, 360, false);
        context.fillStyle = fill;
        context.fill();
        context.strokeStyle = stroke;
        context.lineWidth = strokeWidth;
        context.stroke();
        break;
    case 'box':
        const s = strokeWidth + 0.5
        context.beginPath();
        context.moveTo(s, s);
        context.lineTo(radius * 2 - s, s);
        context.lineTo(radius * 2 - s, radius * 2 - s);
        context.lineTo(s, radius * 2 - s);
        context.closePath();
        context.fillStyle = fill;
        context.fill();
        context.strokeStyle = stroke;
        context.lineWidth = strokeWidth;
        context.stroke();
        break;
    case 'marker':
        canvas.height = canvas.height * 1.2;
        context.beginPath();
        context.arc(radius, radius, radius - strokeWidth - 0.5,  0.2 * Math.PI,  0.8 * Math.PI, true);
        context.lineTo(radius, canvas.height - 0.5);
        context.closePath();
        context.fillStyle = fill;
        context.fill();
        context.strokeStyle = stroke;
        context.lineWidth = strokeWidth;
        context.stroke();
        break;
    default: // fallback when unicode is 'undefined'
        if ('__default' in this.faMarkerCache) {
            return this.faMarkerCache.__default;
        }
        const r = 12;
        canvas.width = r * 2 + 1;
        canvas.height = r * 3.2 + 1;

        context.beginPath();
        context.arc(r, r, r - 0.5, 0.165 * Math.PI, 0.835 * Math.PI, true);
        context.lineTo(r, canvas.height);
        context.closePath();
        context.fillStyle = 'rgb(234, 85, 80)';
        context.fill();

        context.beginPath();
        context.arc(r, r, r - 0.5, 0.165 * Math.PI, 0.835 * Math.PI, true);
        context.lineTo(r, canvas.height - 1);
        context.closePath();
        context.strokeStyle = 'rgb(117, 42, 40)';
        context.lineWidth = 1;
        context.stroke();

        context.beginPath();
        context.arc(r, r, r * 0.4, 0, 2 * Math.PI, true);
        context.fillStyle = 'rgb(117, 42, 40)';
        context.fill();

        this.faMarkerCache.__default = canvas.toDataURL('image/png', 1.0);
        return this.faMarkerCache.__default;
    }

    context.font = `600 ${size}px "Font Awesome 5 Free"`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = color;
    context.fillText(unicode, radius, radius);

    this.faMarkerCache[hash] = canvas.toDataURL('image/png', 1.0);
    return this.faMarkerCache[hash];
}

const buildIconImage = function buildIconImage(poi ,style) {
    if (poi.icon) {
        if (typeof poi.icon === 'string') {
            return poi.icon;
        }
        if ('fontawesome' in poi.icon) {
            if (typeof poi.icon.fontawesome === 'string') {
                poi.icon.fontawesome = {'glyph': poi.icon.fontawesome || 'fa-star'};
            }
            return poi.icon.fontawesome.glyph.startsWith('fa-')
                ? fontAwesomeIcon.call(this, poi.icon.fontawesome)
                : this.pinBuilder.fromMakiIconId(
                    poi.icon.fontawesome.glyph,
                    poi.icon.fontawesome.color || Color.GREEN,
                    poi.icon.fontawesome.size || 48);
        }
        if ('src' in poi.icon) {
            return poi.icon.src;
        }
    }

    return this.pinBuilder.fromMakiIconId('star', Color.GREEN, 48);
}

const buildPoint = function buildPoint(poi, style) {
    return {
        id: poi.id,
        position: Cartesian3.fromDegrees(poi.location.coordinates[0], poi.location.coordinates[1]),
        billboard: {
            image: buildIconImage.call(this, poi, style),
            verticalOrigin: VerticalOrigin.BOTTOM,
        },
        description: poi.infoWindow || poi.tooltip || ''
    };
}

const buildMultiPoint = function buildMultiPoint(poi, style) {
    const image = buildIconImage.call(this, poi, style);
    const ds = new CustomDataSource(poi.id);

    for (let point of poi.location.coordinates) {
        ds.entities.add({
            name: poi.data.name || 'no name',
            position: Cartesian3.fromDegrees(point[0], point[1]),
            billboard: {
                image: image,
                verticalOrigin: VerticalOrigin.BOTTOM,
            },
            description: ''
        })
    }
    return ds;
}

const buildLineString = function buildLineString(poi, style) {
    const coordinates = [];
    for (let p of poi.location.coordinates) {
        coordinates.push(p[0]);
        coordinates.push(p[1]);
    }
    return {
        id: poi.id,
        name: poi.data.name || '',
        description: '',
        polyline: { // Cesium.PolylineGraphics.ConstructorOptions
            positions: Cartesian3.fromDegreesArray(coordinates),
            width: style.stroke.width || 3,
            material: Color.RED,
        }
    }
}

const buildMultiLineString = function buildMultiLineString(poi, style) {
    const ds = new CustomDataSource(poi.id);
    for (let line of poi.location.coordinates) {
        const coordinates = [];
        for (let p of line) {
            coordinates.push(p[0]);
            coordinates.push(p[1]);
        }
        ds.entities.add({
            name: poi.data.name || '',
            description: '',
            polyline: { // Cesium.PolylineGraphics.ConstructorOptions
                positions: Cartesian3.fromDegreesArray(coordinates),
                width: style.stroke.width || 3,
                material: Color.RED,
            }
        });
    }
    return ds;
}

const buildPolygon = function buildPolygon(poi, style) {
    const coordinates = [];
    for (let p of poi.location.coordinates[0]) { // only no holes
        coordinates.push(p[0]);
        coordinates.push(p[1]);
    }
    return {
        id: poi.id,
        name: poi.data.name || '',
        description: '',
        polygon: { // Cesium.PolygonGraphics.ConstructorOptions
            hierarchy: Cartesian3.fromDegreesArray(coordinates),
            height: poi.height || 0,
            material: style.fill.color || Color.BLUE.withAlpha(0.1),
            outline: true,
            outlineColor: style.fill.outlineColor || Color.BLUE,
            outlineWidth: style.fill.outlineWidth || 5,
        }
    }
}

const buildMultiPolygon = function buildMultiPolygon(poi, style) {
    const ds = new CustomDataSource(poi.id);
    for (let polygon of poi.location.coordinates) {
        const coordinates = [];
        for (let p of polygon[0]) { // only no holes
            coordinates.push(p[0]);
            coordinates.push(p[1]);
        }
        ds.entities.add({
            name: poi.data.name || '',
            description: '',
            polygon: { // Cesium.PolygonGraphics.ConstructorOptions
                hierarchy: Cartesian3.fromDegreesArray(coordinates),
                height: poi.height || 0,
                material: style.fill.color || Color.BLUE.withAlpha(0.1),
                outline: true,
                outlineColor: style.fill.outlineColor || Color.BLUE,
                outlineWidth: style.fill.outlineWidth || 5,
            }
        });
    }
    return ds;
}

CesiumJs.prototype.execCommands = function (commands) {
    _execCommands.call(this, commands, this.executingCmd);
}

// =========================================================================
// PRIVATE MEMBERS
// =========================================================================
const sendPoIList = function sendPoIList() {
    if (MashupPlatform.widget.outputs.poiListOutput.connected) {
        const rect = this.viewer.camera.computeViewRectangle(this.viewer.scene.globe.ellipsoid, this.scratchRectangle);
        const w = Math.toDegrees(rect.west).toFixed(4);
        const s = Math.toDegrees(rect.south).toFixed(4);
        const e = Math.toDegrees(rect.east).toFixed(4);
        const n = Math.toDegrees(rect.north).toFixed(4);
        const bbox = turf.polygon([[[w, n], [e, n], [e, s], [w, s], [w, n]]]);
        let poiList = [];
        for (let key in this.pois) {
            let poi = this.pois[key];
            if (turf.booleanIntersects(getFeature(poi), bbox)) {
                poiList.push(poi.data);
            }
        };
        MashupPlatform.widget.outputs.poiListOutput.pushEvent(poiList);
    }
}

const getFeature = function getFeature(poi) {
    if (!poi.hasOwnProperty('__feature')) {
        switch (poi.location.type) {
        case 'Point':
            poi.__feature = turf.point(poi.location.coordinates);
            break;
        case 'MultiPoint':
            poi.__feature = turf.multiPoint(poi.location.coordinates);
            break;
        case 'LineString':
            poi.__feature = turf.lineString(poi.location.coordinates);
            break;
        case 'MultiLineString':
            poi.__feature = turf.multiLineString(poi.location.coordinates);
            break;
        case 'Polygon':
            poi.__feature = turf.polygon(poi.location.coordinates);
            break;
        case 'MultiPolygon':
            poi.__feature = turf.multiPolygon(poi.location.coordinates);
            break;
        }
    }
    return poi.__feature;
}

const _execCommands = function _execCommands(commands, _executingCmd) {
    if (!this.waiting) {
        this.executingCmd = _executingCmd;
        if (!Array.isArray(commands)) {
            commands = [commands];
        }
        this.queue = this.queue.concat(commands);

        if (this.executingCmd == '' && this.queue.length > 0) {
            let cmd = this.queue.shift();
            if (!cmd.hasOwnProperty('value')) {
                cmd.value = {}
            }
            if (cmd.type != null) {
                this.executingCmd = cmd.type.toLowerCase();
                if (commandList[this.executingCmd] != null) {
                    commandList[this.executingCmd].call(this, cmd.value);
                } else {
                    MashupPlatform.widget.log(`${this.executingCmd} not found`, MashupPlatform.log.INFO);
                    this.executingCmd = ''
                }
            }
        }
    }
    this.debug && MashupPlatform.widget.log(`exec: ${this.executingCmd}, queue: ${this.queue.length}`, MashupPlatform.log.INFO);
}

const execEnd = function execEnd() {
    setTimeout(() => {
        _execCommands.call(this, [], '');
    }, 0);
};

const commandList = {
    'add3dtileset': function (value) {
        if (value.longitude != null && value.latitude != null) {
            this.viewer.camera.setView({
                destination: Cartesian3.fromDegrees(value.longitude, value.latitude, value.height || 0.0)
            })
        }

        const tileset = this.viewer.scene.primitives.add(
            new Cesium3DTileset({
                url: value.url
            })
        )

        tileset.style = new Cesium3DTileStyle({
            pointSize: value.pointSize || 5
        })

        this.viewer.zoomTo(tileset)

        execEnd.call(this);
    },
    'setView': function (value) {
        this.viewer.camera.setView({
            destination: Cartesian3.fromDegrees(
                value.longitude,
                value.latitude,
                value.height || 0.0,
                value.ellipsoid || 'Ellipsoid.WGS84')
        })
        execEnd.call(this);
    },
    'flyto': function (value) {
        this.viewer.camera.flyTo({
            destination: Cartesian3.fromDegrees(
                value.longitude,
                value.latitude,
                value.height || 0.0
            )
        })
        execEnd.call(this);
    },
    'rotatecamera': function (value) {
        // Lock camera to a point
        const center = Cartesian3.fromDegrees(value.longitude, value.latitude, value.height);
        const transform = Transforms.eastNorthUpToFixedFrame(center);
        this.viewer.scene.camera.lookAtTransform(transform, new HeadingPitchRange(0, -Math.PI / 8, 2900));

        // Orbit this point
        this. viewer.clock.onTick.addEventListener(clock => {
            this. viewer.scene.camera.rotateRight(0.005);
        });
        execEnd.call(this);
    },
    'addgsiprovider': function (value) {
        this.viewer.imageryLayers.removeAll();
        this.viewer.imageryLayers.addImageryProvider(
            new JapanGSIImageryProvider(
                value.imagery || { layerLists: ["ort","relief","std"] }
            )
        );
        this.viewer.terrainProvider = new JapanGSITerrainProvider(
            value.terrain || {}
        );
        execEnd.call(this);
    },
    'addgsiimageryprovider': function (value) {
        this.viewer.imageryLayers.removeAll();
        this.viewer.imageryLayers.addImageryProvider(
            new JapanGSIImageryProvider(
                value.imagery || { layerLists: ["ort","relief","std"] }
            )
        );
        execEnd.call(this);
    },
    'addgsiterrainprovider': function (value) {
        this.viewer.terrainProvider = new JapanGSITerrainProvider(
            value.terrain || {}
        );
        execEnd.call(this);
    },
}
