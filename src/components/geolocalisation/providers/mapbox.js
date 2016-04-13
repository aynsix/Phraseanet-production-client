/* eslint-disable quotes */
/* eslint-disable no-undef */
import $ from 'jquery';
import _ from 'underscore';
import markerCollection from './markerCollection';
import {generateRandStr} from '../../utils/utils';
import provider from '../provider';

require('mapbox.js/theme/style.css');
require('./mapbox.css');
require('leaflet-draw/dist/leaflet.draw.css');
const leafletMap = (services) => {
    const {configService, localeService, eventEmitter} = services;
    let $container = null;
    let parentOptions = {};
    let tabOptions = {};
    let mapOptions = {};
    let mapUID;
    let mapbox;
    let leafletDraw;
    let featureLayer = null;
    let map = null;
    let geocoder = null;
    let $tabContent;
    let tabContainerName = 'leafletTabContainer';
    let editable;
    let drawable;
    let drawnItems;
    let activeProvider = {};
    const initialize = (options) => {
        let initWith = {$container, parentOptions} = options;
        tabOptions = options.tabOptions || false;
        mapOptions = options.mapOptions !== undefined ? _.extend(mapOptions, options.mapOptions) : mapOptions;
        editable = options.editable || false;
        drawable = options.drawable || false;
        drawnItems = options.drawnItems || false;

        mapUID = 'leafletMap' + generateRandStr(5);

        let providerConfig = provider(services);

        if (providerConfig.initialize() === true) {
            activeProvider = providerConfig.getConfiguration();

            if (tabOptions !== false) {
                // @TODO deepmerge
                let tabPlist = _.extend({
                    tabProperties: {
                        id: tabContainerName,
                        title: localeService.t('Geolocalisation'),
                        classes: 'descBoxes'
                    },
                    position: 1
                }, tabOptions);
                eventEmitter.emit('appendTab', tabPlist);
            }
        }
        onResizeEditor = _.debounce(onResizeEditor, 300);
    };

    const onRecordSelectionChanged = (params) => {
        if (activeProvider.accessToken === undefined) {
            return;
        }
        let {selection} = params;

        refreshMarkers(selection);
    };

    const onTabAdded = (params) => {
        if (activeProvider.accessToken === undefined) {
            return;
        }
        let {origParams, selection} = params;
        if (origParams.tabProperties.id === tabContainerName) {
            $container = $(`#${tabContainerName}`, parentOptions.$container);
            appendMapContent({selection});
        }
    };

    const appendMapContent = (params) => {
        let {selection} = params;
        loadLeaflet(selection);
    }

    const loadLeaflet = (pois) => {
        require.ensure([], () => {
            // select geocoding provider:
            mapbox = require('mapbox.js');
            leafletDraw = require('leaflet-draw');
            // require('leaflet-contextmenu');

            $container.empty().append(`<div id="${mapUID}" class="phrasea-popup" style="width: 100%;height:100%; position: absolute;top:0;left:0"></div>`);

            L.mapbox.accessToken = activeProvider.accessToken;
            console.log('passed options', mapOptions)
            map = L.mapbox.map(mapUID, 'mapbox.streets', mapOptions)
                .setView(activeProvider.defaultPosition, activeProvider.defaultZoom);

            var layers = {
                Streets: L.mapbox.tileLayer('mapbox.streets'),
                Outdoors: L.mapbox.tileLayer('mapbox.outdoors'),
                Satellite: L.mapbox.tileLayer('mapbox.satellite')
            };

            layers.Streets.addTo(map);
            L.control.layers(layers).addTo(map);

            geocoder = L.mapbox.geocoder('mapbox.places');

            if (drawable) {
                addDrawableLayers();
            }
            addMarkersLayers();
            refreshMarkers(pois);
        });
    };

    const addDrawableLayers = () => {

        // should restore drawn items?
        // user.getPreferences
        let drawingGroup;
        /*        if( drawnItems !== false) {
         drawingGroup = L.geoJson(drawnItems);
         } else {
         }*/
        console.log('init drawing group with drawn items', drawnItems)
        drawingGroup = L.geoJson(drawnItems, {
            style: function (feature) {
                return {
                    color: '#0c4554'
                }; //feature.properties && feature.properties.style;
            }
        }); //new L.FeatureGroup();


        map.addLayer(drawingGroup);

        // Initialise the draw control and pass it the FeatureGroup of editable layers
        let drawControl = new L.Control.Draw({
            draw: {
                circle: false,
                polyline: false,
                polygon: false,
                marker: false,
                position: 'topleft',
                rectangle: {
                    //title: 'Draw a sexy polygon!',
                    allowIntersection: false,
                    drawError: {
                        color: '#b00b00',
                        timeout: 1000
                    },
                    shapeOptions: {
                        color: '#0c4554'
                    },
                    showArea: true
                },
            },
            edit: {
                featureGroup: drawingGroup,
                // @TODO tranlations
                /*toolbar: {
                 actions: {
                 save: {
                 title: 'Save changes.',
                 text: 'Save'
                 },
                 cancel: {
                 title: 'Cancel editing, discards all changes.',
                 text: 'Cancel'
                 }
                 },
                 buttons: {
                 edit: 'Edit layers.',
                 editDisabled: 'No layers to edit.',
                 remove: 'Delete layers.',
                 removeDisabled: 'No layers to delete.'
                 }
                 },
                 handlers: {
                 edit: {
                 tooltip: {
                 text: 'Drag handles, or marker to edit feature.',
                 subtext: 'Click cancel to undo changes.'
                 }
                 },
                 remove: {
                 tooltip: {
                 text: 'Click on a feature to remove'
                 }
                 }
                 }*/
            }
        });
        let shapesDrawed = {};
        map.addControl(drawControl);

        map.on('draw:created', (event) => {
            let type = event.layerType;
            let layer = event.layer;
            let layerId = drawingGroup.getLayerId(layer);

            shapesDrawed[layerId] = {
                type: type,
                bounds: getMappedFieldsCollection(layer.getLatLngs())
            };
            console.log('>>>>>> send serialized version', drawingGroup, drawingGroup.toGeoJSON())
            drawingGroup.addLayer(layer);
            eventEmitter.emit('shapeCreated', {shapes: shapesDrawed, drawnItems: drawingGroup.toGeoJSON()});
        });
        map.on('draw:edited', (event) => {
            let layers = event.layers;
            layers.eachLayer(function (layer) {
                let layerId = drawingGroup.getLayerId(layer);
                // get type from drawed shape:
                let currentType = shapesDrawed[layerId].type;
                shapesDrawed[layerId] = {
                    type: currentType,
                    bounds: getMappedFieldsCollection(layer.getLatLngs())
                }
            });
            eventEmitter.emit('shapeEdited', {shapes: shapesDrawed, drawnItems: drawingGroup.toGeoJSON()});
        });
        map.on('draw:deleted', (event) => {
            let layers = event.layers;
            layers.eachLayer(function (layer) {
                let layerId = drawingGroup.getLayerId(layer);
                delete shapesDrawed[layerId];
            });
            eventEmitter.emit('shapeRemoved', {shapes: shapesDrawed, drawnItems: drawingGroup.toGeoJSON()});
        });
    };

    const addMarkersLayers = () => {
        if (featureLayer !== null) {
            featureLayer.clearLayers();
        } else {
            featureLayer = L.mapbox.featureLayer([], {
                pointToLayer: function (feature, latlon) {
                    if (feature.properties.radius !== undefined) {
                        // L.circleMarker() draws a circle with fixed radius in pixels.
                        // To draw a circle overlay with a radius in meters, use L.circle()
                        return L.circleMarker(latlon, {radius: feature.properties.radius || 10});
                    } else {
                        let marker = require('mapbox.js/src/marker.js'); //L.marker(feature);
                        return marker.style(feature, latlon, {accessToken: activeProvider.accessToken});
                    }
                }
            }).addTo(map);
        }
    };

    const refreshMarkers = (pois) => {

        buildGeoJson(pois).then((geoJsonPoiCollection) => {
            addMarkersLayers();

            let markerColl = markerCollection(services);
            markerColl.initialize({map, featureLayer, geoJsonPoiCollection, editable});

            if (featureLayer.getLayers().length > 0) {
                map.fitBounds(featureLayer.getBounds(), {maxZoom: activeProvider.markerDefaultZoom});
            } else {
                // set default position
                map.setView(activeProvider.defaultPosition, activeProvider.defaultZoom);
            }
        })

    };
    /**
     * build geoJson features return as a promise
     * @param pois
     * @returns {*}
     */
    const buildGeoJson = (pois) => {
        let geoJsonPoiCollection = [];
        let asyncQueries = [];
        let geoJsonPromise = $.Deferred();

        for (let poiIndex in pois) {
            let poi = pois[poiIndex];
            let poiCoords = extractCoords(poi);
            let poiTitle = poi.FileName || poi.Filename || poi.Title;
            if (poiCoords[0] !== false && poiCoords[1] !== false) {
                geoJsonPoiCollection.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: poiCoords
                    },
                    properties: {
                        recordIndex: poiIndex,
                        'marker-color': '0c4554',
                        'marker-zoom': '5',
                        title: `${poiTitle}`
                    }
                });
            } else {
                // coords are not available, fallback on city/province/country if available

                let query = '';
                query += poi.City !== undefined && poi.City !== null ? poi.City : '';
                query += poi.Country !== undefined && poi.Country !== null ? `, ${poi.Country} ` : '';

                if (query !== '') {
                    let geoPromise = $.Deferred();
                    geocoder.query(query, (err, data) => {
                        // take the first feature if exists
                        if (data.results !== undefined) {
                            if (data.results.features.length > 0) {

                                /*let circleArea = {
                                 type: 'Feature',
                                 geometry: {
                                 type: 'Point',
                                 coordinates: data.results.features[0].center //[[ data.bounds ]]
                                 },
                                 properties: {
                                 title: `${poi.FileName}`
                                 }
                                 };
                                 circleArea.properties['marker-zoom'] = 5;
                                 circleArea.properties.radius = 50;

                                 geoJsonPoiCollection.push(circleArea);*/

                                let bestResult = data.results.features[0];
                                bestResult.properties.recordIndex = poiIndex;
                                bestResult.properties['marker-zoom'] = 5;
                                bestResult.properties.title = `${poiTitle}`;
                                geoJsonPoiCollection.push(bestResult);
                            }

                        }

                        geoPromise.resolve(geoJsonPoiCollection)
                    });
                    asyncQueries.push(geoPromise);
                }
            }
        }

        if (asyncQueries.length > 0) {
            $.when.apply(null, asyncQueries).done(function () {
                geoJsonPromise.resolve(geoJsonPoiCollection)
            });
        } else {
            geoJsonPromise.resolve(geoJsonPoiCollection)
        }
        return geoJsonPromise.promise();
    };

    const extractCoords = (poi) => {
        return [activeProvider.fieldPosition.longitude(poi), activeProvider.fieldPosition.latitude(poi)];
    };

    let onResizeEditor = () => {
        if (activeProvider.accessToken === undefined) {
            return;
        }
        if (map !== null) {
            map.invalidateSize();
            if (featureLayer.getLayers().length > 0) {
                map.fitBounds(featureLayer.getBounds(), {maxZoom: activeProvider.markerDefaultZoom});
            } else {
                // set default position
                map.setView(activeProvider.defaultPosition, activeProvider.defaultZoom);
            }
        }
    };

    const onMarkerChange = (params) => {
        let {marker, position} = params;

        if (editable) {
            let mappedFields = getMappedFields(position);
            let wrappedMappedFields = {};
            // values needs to be wrapped in a array:
            for (let mappedFieldIndex in mappedFields) {
                if (mappedFields.hasOwnProperty(mappedFieldIndex)) {
                    wrappedMappedFields[mappedFieldIndex] = [mappedFields[mappedFieldIndex]]
                }
            }
            console.log('values has been wrapped', wrappedMappedFields)
            let presets = {
                fields: wrappedMappedFields //presetFields
            };
            let recordIndex = marker.feature.properties.recordIndex;

            eventEmitter.emit('recordEditor.addPresetValuesFromDataSource', {data: presets, recordIndex});
        }
    };
    const getMappedFields = (position) => {
        let fieldMapping = activeProvider.provider['position-fields'];
        let mappedFields = {};
        if (fieldMapping.length > 0) {

            _.each(fieldMapping, (mapping) => {
                // latitude and longitude are combined in a composite field
                if (mapping.type === 'latlng') {
                    mappedFields[mapping.name] = `${position.lat} ${position.lng}`;
                } else if (mapping.type === 'lat') {
                    mappedFields[mapping.name] = `${position.lat}`;
                } else if (mapping.type === 'lng') {
                    mappedFields[mapping.name] = `${position.lng}`;
                }
            });
        }
        return mappedFields;
    }

    const getMappedFieldsCollection = (positions) => {
        let mappedPositions = [];
        for (let positionIndex in positions) {
            if (positions.hasOwnProperty(positionIndex)) {
                mappedPositions.push(getMappedFields(positions[positionIndex]))
            }
        }
        return mappedPositions;
    }


    eventEmitter.listenAll({
        'recordSelection.changed': onRecordSelectionChanged,
        'appendTab.complete': onTabAdded,
        /* eslint-disable quote-props */
        'markerChange': onMarkerChange,
        'tabChange': onResizeEditor,
    });
    return {initialize, appendMapContent}
};

export default leafletMap;
