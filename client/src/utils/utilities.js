import axios from 'axios';
import React from 'react';

export function arrToObject(arr) {
  const obj = arr.reduce((acc, elem) => {
    acc[elem.name] = Object.assign({}, elem);
    return acc;
  }, {});
  return obj;
}

/* eslint-disable */
export function camelize(str) {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function (letter, index) {
    return index == 0 ? letter.toLowerCase() : letter.toUpperCase();
  }).replace(/\s+/g, '');
}

function printUnique(mapdata) {
  const gh = mapdata.map(group => group.groupsharassed);
  const ghDelimited = gh
    .map(group => group.split(','))
    .reduce((acc, val) => acc.concat(val), []);
  const noDupes = Array.from(new Set(ghDelimited));
  console.log(noDupes);
}
/* eslint-enable */

export function createDataToSubmit(formData) {
  const { targetCategory, groups, primaryGroup, groupsChecked, groupsExpanded,
          latLng, location, sourceurl, other_race, other_religion, other_gender, other_misc,
          date, description } = formData;
  return ({
    lat: latLng.lat,
    lon: latLng.lng,
    location: location,
    incidentdate: date,
    sourceurl: sourceurl,
    primaryGroup: primaryGroup,
    groups: groupsChecked,
    other_race: other_race,
    other_religion: other_religion,
    other_gender: other_gender,
    other_misc: other_misc,
    description: description
  });
}

export const reviewIncidentReport = (id, verified, callback = null) => () => {
  axios.post('/api/verify/reviewedincident', { id, verified })
    .then(res => {
      console.log(res.data)
      callback();
      window.location.reload();
    })
    .catch(err => console.log(err));
};

export const validateIncidentReport = (id, urlvalid, callback = null) => () => {
  axios.post('/api/verify/validateincident', { id, urlvalid })
    .then(res => {
      console.log(res.data)
      callback();
      window.location.reload();
    })
    .catch(err => console.log(err));
};

export const publishedIncidentReport = (id, published, callback = null) => () => {
  axios.post('/api/verify/publishedincident', { id, published })
    .then(res => {
      console.log(res.data)
      callback();
      window.location.reload();
    })
    .catch(err => console.log(err));
};

export const deleteIncidentReport = (id, callback = null) => () => {
  axios.delete('/api/verify/incidentreport', { data: { id } })
    .then(res => console.log(res.data))
    .catch(err => console.log(err));
  callback();
  window.location.reload();
};

export const addRowNumProperty = (data) => {
  data.forEach((point, i) => {
    point.rowNum = i;
    const camelized = point.groupsharassedsplit.map(group => camelize(group));
    point.camelized = new Set(camelized);
  });
};

export const setCookie = (cname, cvalue, exdays) => {
  const d = new Date();
  d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
  const expires = `expires=${d.toUTCString()}`;
  document.cookie = `${cname}=${cvalue};${expires};path=/`;
};

const getCookie = (cname) => {
  const name = `${cname}=`;
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) === 0) {
      return c.substring(name.length, c.length);
    }
  }
  return '';
};

export const checkLoggedInCookie = () => {
  const loggedIn = getCookie('loggedIn');
  return loggedIn !== '';
};

export function getSourceLI(sourceurl, validsourceurl, waybackurl, validwaybackurl) {
  if (validsourceurl) {
    return <li><a href={sourceurl} target="_blank">Source</a></li>;
  }
  if (validwaybackurl) {
    return <li><a href={waybackurl} target="_blank">Source</a></li>;
  }
  return <li>Source not listed</li>;
}

export function sortByDateSubmitted(arr) {
  arr.sort((a, b) => new Date(a.datesubmitted) - new Date(b.datesubmitted));
}
