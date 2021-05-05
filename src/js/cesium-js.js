/*
 * Cesium.js widget
 * https://github.com/lets-fiware/cesium-js-widget
 *
 * Copyright (c) 2021 Kazuhito Suda
 * Licensed under Apache-2.0 License
 */

import {Ion,
    Cartesian3,
    Cesium3DTileStyle,
    Cesium3DTileset,
    Color,
    Credit,
    CustomDataSource,
    Ellipsoid,
    HeadingPitchRange,
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

import "cesium/Build/Cesium/Widgets/widgets.css";
import * as turf from '@turf/turf';

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
        homeButton:MashupPlatform.prefs.get('homeButton'),
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
    this.screenSpaceEventHandler.setInputAction( e => { 
            if (MashupPlatform.widget.outputs.poiOutput.connected) {
                const picked = this.viewer.scene.pick(e.position); 
                if (picked) { 
                    const feature = this.pois[picked.id.id];
                    if (feature) {
                        MashupPlatform.widget.outputs.poiOutput.pushEvent(feature); 
                    } else {
                        const feature = tihs.pois[picked.id.entityCollection.owner.name];
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
    if (poi_info.length) {
        poi_info.forEach(poi => registerPoI.call(this, poi, true));
        const poi = poi_info[poi_info.length - 1];
        if (poi.location.type == 'Point') {
            this.viewer.flyTo(this.pois[poi.id]);
        } else {
            const box = turf.envelope(getFeature(poi)).bbox;
            const rect = new Rectangle();
            Rectangle.fromDegrees(box[0], box[1], box[2], box[3], rect);
            this.viewer.camera.flyTo({
                destination: rect
            });
        }
    }
    sendPoIList.call(this);
}

CesiumJs.prototype.removePoIs = function removePoIs(pois_info) {
    pois_info.forEach(poi => {
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
        delete this.pois[poi.id];
    });
    sendPoIList.call(this);
}

const registerPoI = function registerPoI(poi, update) {
    if (!poi.data) {
        poi.data = {};
    }
    if (!poi.style) {
        poi.style = {};
    }
    if (!poi.style.fontSymbol) {
        poi.sytle.fontSymbol = {}
    }
    if (!poi.style.fill) {
        poi.style.fill = {}
    }
    switch (poi.location.type) {
    case 'Point':
        this.viewer.entities.add(buildPoint.call(this, poi));
        break;
    case 'MultiPoint':
        this.viewer.dataSources.add(buildMultiPoint.call(this, poi));
        break;
    case 'LineString':
        this.viewer.entities.add(buildLineString(poi))
        break;
    case 'MultiLineString':
        this.viewer.dataSources.add(buildMultiLineString(poi));
        break;
    case 'Polygon':
        this.viewer.entities.add(buildPolygon(poi))
        break;
    case 'MultiPolygon':
        this.viewer.dataSources.add(buildMultiPolygon(poi));
        break;
    default:
        MashupPlatform.widget.log(`Unknown type: ${poi.location.type}, id: ${poi.id}`, MashupPlatform.log.INFO);
        return;
    }
    this.pois[poi.id] = poi;
}

const buildPoint = function buildPoint(poi) {
    const image = ('icon' in poi)
        ? ((typeof poi.icon === 'string') ? poi.icon : poi.icon.src)
        : this.pinBuilder.fromMakiIconId(
            poi.style.fontSymbol.glyph || 'star',
            poi.style.fontSymbol.color ||Color.GREEN,
            poi.style.fontSymbol.size || 48);

    return {
        id: poi.title || poi.id,
        position: Cartesian3.fromDegrees(poi.location.coordinates[0], poi.location.coordinates[1]),
        billboard: {
            image: image,
            verticalOrigin: VerticalOrigin.BOTTOM,
        },
        description: poi.infoWindow || poi.tooltip
    };
}

const buildMultiPoint = function buildMultiPoint(poi) {
    const image = ('icon' in poi)
        ? ((typeof poi.icon === 'string') ? poi.icon : poi.icon.src)
        : this.pinBuilder.fromMakiIconId(
            poi.style.fontSymbol.glyph || 'star',
            poi.style.fontSymbol.color ||Color.GREEN,
            poi.style.fontSymbol.size || 48);

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

const buildLineString = function buildLineString(poi) {
    const coordinates = [];
    for (let p of poi.location.coordinates) {
        coordinates.push(p[0]);
        coordinates.push(p[1]);
    }
    return {
        id: poi.id,
        name: poi.data.name || '',
        description: '',　
        polyline : { // Cesium.PolylineGraphics.ConstructorOptions
            positions: Cartesian3.fromDegreesArray(coordinates),
            width: poi.style.stroke.width || 3,
            material: Color.RED,
        }        
    }
}

const buildMultiLineString = function buildMultiLineString(poi) {
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
            polyline : { // Cesium.PolylineGraphics.ConstructorOptions
                positions: Cartesian3.fromDegreesArray(coordinates),
                width: pio.style.stroke.width || 3,
                material: Color.RED,
            }        
        });
    }
    return ds;
}

const buildPolygon = function buildPolygon(poi) {
    const coordinates = [];
    for (let p of poi.location.coordinates[0]) { // only no holes
        coordinates.push(p[0]);
        coordinates.push(p[1]);
    }
    return {
        id: poi.id,
        name: poi.data.name || '',
        description: '',　
        polygon : { // Cesium.PolygonGraphics.ConstructorOptions
            hierarchy: Cartesian3.fromDegreesArray(coordinates),
            height : poi.height || 0,
            material : poi.style.fill.color || Color.BLUE.withAlpha(0.1),
            outline : true,
            outlineColor : poi.style.fill.outlineColor || Color.BLUE,
            outlineWidth: poi.style.fill.outlineWidth || 5,
        }        
    }
}

const buildMultiPolygon = function buildMultiPolygon(poi) {
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
            polygon : { // Cesium.PolygonGraphics.ConstructorOptions
                hierarchy: Cartesian3.fromDegreesArray(coordinates),
                height : poi.height || 0,
                material : poi.style.fill.color || Color.BLUE.withAlpha(0.1),
                outline : true,
                outlineColor : poi.style.fill.outlineColor || Color.BLUE,
                outlineWidth: poi.style.fill.outlineWidth || 5,
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
const colorTable = {
    transparent: '',
    white: '#ffffff',
    silver: '#c0c0c0',
    gray: '#808080',
    black: '#000000',
    red: '#ff0000',
    maroon: '#800000',
    yellow: '#ffff00',
    olive: '#808000',
    lime: '#00ff00',
    green: '#008000',
    aqua: '#00ffff',
    teal: '#008080',
    blue: '#0000ff',
    navy: '#000080',
    fuchsia: '#ff00ff',
    purple: '#800080',
    orange: '#ffa500',
    naivy: '#1f2f54',
    'fi-cyan': '#5dc0cf',
    'fi-naivy': '#002e67',
    'fi-green': '#15a97c',
    'fi-grey': '#b1b2b4',
    'fi-red': '#d36b59',
}

const getColorCode = function getColorCode(color, defaultColor) {
    if (color != null) {
        color = color.toLowerCase();
        if (color.substr(0, 1) == '#') {
            return color;
        } else if (color in colorTable) {
            return colorTable[color];
        }
    }
    return defaultColor;
}

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
        switch (poi.data.location.type) {
        case 'Point':
            poi.__feature = turf.point(poi.data.location.coordinates);
            break;
        case 'MultiPoint':
            poi.__feature = turf.multiPoint(poi.data.location.coordinates);
            break;
        case 'LineString':
            poi.__feature = turf.lineString(poi.data.location.coordinates);
            break;
        case 'MultiLineString':
            poi.__feature = turf.multiLineString(poi.data.location.coordinates);
            break;
        case 'Polygon':
            poi.__feature = turf.polygon(poi.data.location.coordinates);
            break;
        case 'MultiPolygon':
            poi.__feature = turf.multiPolygon(poi.data.location.coordinates);
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
    'setView': function(value) {
        this.viewer.camera.setView({
            destination: Cartesian3.fromDegrees(
                value.longitude,
                value.latitude,
                value.height || 0.0,
                value.ellipsoid || 'Ellipsoid.WGS84')
        })
        execEnd.call(this);
    },
    'flyto': function(value) {
        this.viewer.camera.flyTo({
            destination : Cesium.Cartesian3.fromDegrees(
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
        this.viewer.scene.camera.lookAtTransform(transform, new HeadingPitchRange(0, -Math.PI/8, 2900));

        // Orbit this point
        this. viewer.clock.onTick.addEventListener(clock => {
          this. viewer.scene.camera.rotateRight(0.005);
        });
        execEnd.call(this);
    },

}
