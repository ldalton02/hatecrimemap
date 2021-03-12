import React from 'react';
import { Map, TileLayer, MapControl } from 'react-leaflet';
import { Rectangle, GeoJSON } from 'react-leaflet';
import { usa } from '../../res/usa.js';
import { counties } from '../../res/counties/statecounties.js';
import Legend from './Legend/Legend';
import './MapWrapper.css';
import { states_usa } from '../../res/states.js';
import { states_alaska } from '../../res/alaska.js';
import { states_hawaii } from '../../res/hawaii.js';
import { eachState, eachStatesCounties,defaultColors,covidColors } from '../../utils/data-utils';
import { useLocation } from 'react-router-dom';

import Nouislider from "nouislider-react";
import "nouislider/distribute/nouislider.css";

function timestamp(str) {
    return new Date(str).getTime();
}
const years = ["2020", "2021"];
const months_short = [
    "Jan", "Feb", "Mar","Apr", "May", "Jun", "Jul","Aug", "Sep", "Oct","Nov", "Dec"
];
const monthVals = months_short.map(month=>Date.parse(month+" 1, 2020"))


// move to map res utils
const usaCentre = [38., -96.], usaBounds = [[18., -135.], [52., -60.]];
const alaskaCentre = [64., -150.], alaskaBounds = [[34., -110.], [94., -190.]];
const hawaiiCentre = [20., -155.], hawaiiBounds = [[0., -170.], [40., -135.]];
const worldBounds = [[-90., -180.], [90., 180.]]


const MapWrapper = (props) => {
  const location = useLocation();
  let theColors;
  let covidFlag;
  if (location.pathname=="/covid") {
    theColors = covidColors;
    covidFlag = 1
  }
  else{
    theColors = defaultColors;
    covidFlag = 0
  }

  return (
    <div id="MapWrapper">
      <div id="timeslider">
        <Nouislider behaviour='tap-drag'
                    connect
                    range={{
                        min: timestamp('Jan 1,2020'),
                        max: timestamp(Date.now())
                    }}
                    direction='ltr'
                    step={24 * 60 * 60 * 1000}
                    start={[timestamp('Jan 1,2020'), timestamp(Date.now())]}
                    />
      </div>
      <Map id="USA" ref={props.mapRef} maxBounds={worldBounds} minZoom={2} zoomSnap={0.25} center={usaCentre} zoom={4.5} zoomEnd={props.updateZoom}>
        <TileLayer bounds={worldBounds} attribution="&amp;copy <a href=&quot;http://osm.org/copyright&quot;>OpenStreetMap</a> contributors"
        url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png" />
          <Rectangle bounds={worldBounds} stroke={false} fillOpacity="0" onClick={() => props.updateState("none", true)} />
          { props.zoom >= 6 && counties.map((state, index) => <GeoJSON key={index} data={state} onEahFeature={(feature, layer) => eachStatesCounties(feature, layer, props.data.counties, props.updateCounty,theColors)} /> ) }     
          <GeoJSON ref={props.statesRef} data={states_usa} onAdd={() => props.updateView(0, 1)} onEachFeature={(feature, layer) => eachState(feature, layer, props.data, 100, props.updateState,theColors)} />
          <GeoJSON ref={props.alaskaRef} data={states_alaska} onEachFeature={(feature, layer) => eachState(feature, layer, props.data, 100, props.updateState,theColors)} />
          <GeoJSON ref={props.hawaiiRef} data={states_hawaii} onEachFeature={(feature, layer) => eachState(feature, layer, props.data, 100, props.updateState,theColors)} />
          <GeoJSON data={usa} onEachFeature={(feature, layer) => { layer.setStyle({stroke: 0.3, color: '#777777'})}} />
        <Legend colors={theColors} covid={covidFlag} />
        
        {props.children}
      </Map>
    </div>
  );
};



MapWrapper.propTypes = {
  // mapdata: PropTypes.arrayOf(PropTypes.object).isRequired,
  // zoom: PropTypes.function.isRequired,
};
//https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png
export default MapWrapper;