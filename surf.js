$(document).ready(() => {
  addBuoyForecastImages();
  generateLiveBuoyCharts();
  initializeLeafletMap();

  // Listen for when the Map tab is shown
  $('a[data-toggle="tab"][href="#map"]').on('shown.bs.tab', function (e) {
    if (map) {
      map.invalidateSize();
    }
  });
});
window.surfJsLoaded = true;

const addBuoyForecastImages = () => {
  
  $('#montereyBuoy1').attr(
    'src',
    `https://wsrv.nl?url=stormsurf.com/4cast/graphics/gfswave.46042.bull.4.png?disable_cache=${Date.now()}`
  );
  $('#montereyBuoy2').attr(
    'src',
    `https://wsrv.nl?url=stormsurf.com/4cast/graphics/gfswave.46042.bull.5.png?disable_cache=${Date.now()}`
  );
  $('#halfmoonBuoy1').attr(
    'src',
    `https://wsrv.nl?url=stormsurf.com/4cast/graphics/gfswave.46012.bull.4.png?disable_cache=${Date.now()}`
  );
  $('#halfmoonBuoy2').attr(
    'src',
    `https://wsrv.nl?url=stormsurf.com/4cast/graphics/gfswave.46012.bull.5.png?disable_cache=${Date.now()}`
  );
};

const buoys = [
    { Name: 'Point Reyes', lat: 37.94, lng: -123.46, id: '46214', uuid: '623f2558-cecd-11eb-8ee7-024238d3b313'},
    { Name: 'Point Sur', lat: 36.34, lng: -122.1, id: '46239', uuid: '8f74b3c0-cecc-11eb-ad35-024238d3b313'},
    { Name: 'Monterey Canyon Outer', lat: 36.76, lng: -121.95, id: '46236', uuid: 'a7560458-df9d-11ef-ac15-029daffad6a3'},
    { Name: 'Cape San Martin', lat: 35.77, lng: -121.9, id: '46028', uuid: '48a1002e-cecd-11eb-ba0e-024238d3b313'},
    { Name: 'Harvest', lat: 34.45, lng: -120.78, id: '46218', uuid: 'c795cab8-cecc-11eb-84e7-024238d3b313'},
    { Name: 'Santa Lucia Escarpment', lat: 34.77, lng: -121.49, id: '46259', uuid: '599c6d1e-cecc-11eb-885c-024238d3b313'},
    { Name: 'Diablo Canyon', lat: 35.2, lng: -120.86, id: '46215', uuid: 'a96cf346-cecb-11eb-8bb0-024238d3b313'},
    // { Name: 'Soquel Cove South', lat: 36.93, lng: -121.93, id: '46284', uuid: '3072ff0a-b656-11ef-94ee-066f3c48800f'},
    // { Name: 'Cabrillo Point', lat: 36.63, lng: -121.91, id: '46240', uuid: 'a3336676-cecd-11eb-9a27-024238d3b313'},
    // { Name: 'Monterey', lat: 36.79, lng: -122.4, id: '46042', uuid: 'dcfce512-cecb-11eb-b0c8-024238d3b313'},
    // { Name: 'Half Moon Bay', lat: 37.36, lng: -122.88, id: '46012', uuid: '780b2a02-cecb-11eb-9ccc-024238d3b313'},
    // { Name: 'Point Santa Cruz', lat: 36.93, lng: -122.03, id: '46269', uuid: 'a011a1e4-cecb-11eb-abf8-024238d3b313'},
  ];

let map; 

const initializeLeafletMap = () => {
  map = L.map('map', { center: [35.9, -122.5], zoom: 7.2 });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  let pointReyesMarker = null;
  let pointReyesId = null;

  buoys.forEach(buoy => {
    const marker = L.marker([buoy.lat, buoy.lng]).addTo(map)
      .bindPopup(`<b>${buoy.Name}</b>`);

    if (buoy.Name.toLowerCase().includes('point sur')) {
      pointReyesMarker = marker;
      pointReyesId = buoy.id;
    }

    marker.on('click', () => {
      showBuoyChart(buoy.id);
    });
  });

  // Open popup and draw chart for Point Reyes initially
  if (pointReyesMarker && pointReyesId) {
    pointReyesMarker.openPopup();

    const cached = window.buoyDataCache[pointReyesId];
    if (cached) {
      drawMapChart(cached); // <- draw chart for Point Reyes on load
    }
  }
};

function showBuoyChart(buoyId) {
  // Hide all buoy containers
  $('[id^=buoy-]').hide();

  // Show only the selected buoy
  $(`#buoy-${buoyId}`).show();
}

const fetchBuoyData = async (buoyUuid) => {
  let days = 2;
  if (window.innerWidth <= 500 || (window.innerWidth < 991 && window.innerWidth > 768)) days = 2;
  const url = `https://services.surfline.com/kbyg/buoys/report/${buoyUuid}?days=${days}`;
  const response = await window.fetch(url);
  const jsonResponse = await response.json();
  return jsonResponse.data;
};


const generateLiveBuoyCharts = async () => {

  for (const buoy of buoys) {
    const buoyData = await fetchBuoyData(buoy.uuid);
    createLiveBuoyChart(buoy, buoyData); 
  }

};

const createLiveBuoyChart = (buoy, buoyData) => {
  const combinedHeightDataset = {
    data: [],
    label: 'Combined Height',
    group: 'Combined Height',
    borderColor: '#5b5b5b',
    backgroundColor: '#5b5b5b',
    borderWidth: 3,
    pointRadius: 0,
    tension: 0.5,
  };
  let swellDatasets = {};
  const dates = [];
  const waterTemps = [];

  const swellStyleByType = {
      'Short Period Windswell'  : { borderWidth: .5, pointRadius: .5 },
      'Windswell'               : { borderWidth: 1, pointRadius: 1 },
      'Mid Period Swell'        : { borderWidth: 1.5, pointRadius: 1.5 },
      'Groundswell'             : { borderWidth: 2, pointRadius: 2 },
      'Long Period Groundswell' : { borderWidth: 2.5, pointRadius: 2.5 },
    };
    
  buoyData.forEach((datapoint) => {
    const date = new Date(datapoint.timestamp * 1000);
    // There is often duplicate data at 40 and 50 minute marks, so only use one.
    if (date.getMinutes() === 40) return;

    dates.push(date);
    waterTemps.push(datapoint.waterTemperature == null ? '--' : datapoint.waterTemperature);
    // Add a data point for the combined height.
    combinedHeightDataset.data.push({
      x: date,
      y: datapoint.height,
    });
    // Add a data point for each individual swell.
    datapoint.swells.forEach((swell) => {
      const approximateDirection = swell.direction >= 240 ? 'W' : 'S';
      const swellType = periodToSwellType(swell.period);
      const compassDirection = degreeToCompass(swell.direction);
      let key = `${approximateDirection}${swellType.key}`;
      // Ignore unimportant swell readings.
      if (swell.period < 4 || swell.height < 0.5) return;
      if (approximateDirection === 'S' && swellType.key === 'spws') return;

      // It isn't working to have multiple datapoints for a given dataset on the same date,
      // so use a separate key for these extra datapoints
      if (swellDatasets[key] && swellDatasets[key].data.find((dp) => dp.x === date)) {
        key = key + '_secondary';
        if (swellDatasets[key] && swellDatasets[key].data.find((dp) => dp.x === date)) {
          key = key + '_tertiary';
        }
      }

      // Create a new dataset for the swell type if it doesn't already exist.
      const swellStyle = swellStyleByType[swellType.Name] || { borderWidth: 2, pointRadius: 2 };
      if (!swellDatasets[key]) {
        swellDatasets[key] = {
          data: [],
          borderColor: swellType.color,
          backgroundColor: swellType.color,
          tension: 0.5,
          spanGaps: true,
          group: swellType.Name,
          borderWidth: swellStyle.borderWidth,
          pointRadius: swellStyle.pointRadius,
        };
      }

      // Add the datapoint to the dataset.
      swellDatasets[key].data.push({
        x: date,
        y: swell.height,
        label: `${swell.period}s - ${compassDirection} (${swell.direction}°)`,
        ...swell,
      });
    });
  });
  swellDatasets = Object.values(swellDatasets);
  swellDatasets.map((dataset) => {
    const minDir = Math.min(...dataset.data.map((swell) => swell.direction));
    const maxDir = Math.max(...dataset.data.map((swell) => swell.direction));
    dataset.label = `${periodToSwellType(dataset.data[0].period).Name} | ${degreeToCompass(
      minDir
    )} (${minDir}°) - ${degreeToCompass(maxDir)} (${maxDir}°)`;
    dates.forEach((date, index) => {
      const existingDatapoint = dataset.data.find((dp) => dp.x === date);
      if (!existingDatapoint) dataset.data.splice(index, 0, { x: date, y: NaN });
    });
    return dataset;
  });

  const swellTypeOrder = [
    'Short Period Windswell',
    'Windswell',
    'Mid Period Swell',
    'Groundswell',
    'Long Period Groundswell',
    'Long Period Groundswell',
  ];

  console.log('Groups in swellDatasets:', swellDatasets.map(d => d.group));
  swellDatasets.sort((a, b) => {
    return swellTypeOrder.indexOf(a.group) - swellTypeOrder.indexOf(b.group);
  });

  createAndAttachChart(buoy, [combinedHeightDataset, ...swellDatasets]);
  createAndAttachLatestSwellReadings(buoy, dates, swellDatasets, waterTemps[0]);
};

const createAndAttachLatestSwellReadings = (buoy, dates, swellDatasets, waterTemp) => {
  const date = dates[0];
  const lastUpdatedDate = date.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
  $(`#latestSwellReadings-${buoy.id}`).prepend(`<li class='updated-at'>Last update: ${lastUpdatedDate}</li>`);
  swellDatasets.forEach((dataset) => {
    const datapoint = dataset.data[0];
    if (datapoint.x === date && datapoint.y) {
      $(`#latestSwellReadings-${buoy.id}`).append(`
        <li>
          <span class='dot' style='background-color: ${dataset.backgroundColor}'></span>
          ${datapoint.y}ft @ ${datapoint.label}
        </li>
      `);
    }
  });
  $(`#latestSwellReadings-${buoy.id}`).append(`
    <li class='water-temp'>
      <img class='waterdrop' src='https://adektor.github.io/SC_Buoys/waterdrop.png'></img>
      <span>${waterTemp}°</span>
    </li>
  `);
};

const createAndAttachChart = (buoy, datasets) => {
  const ctx = document.getElementById(`buoyChart-${buoy.id}`).getContext('2d');
  Chart.register(verticalLineChartPlugin);
  new Chart(ctx, {
    type: 'line',
    data: { datasets },
    options: {
      scales: {
        x: {
          ticks: {
            font: {
              size: 14
            }
          },
          type: 'time',
          time: {
            unit: 'hour',
            displayFormats: {
              hour: 'ccc h a',
            },
            tooltipFormat: 'cccc M/d - h:mm a',
            stepSize: 4,
          },
        },
        y: {
          ticks: {
            font: {
              size: 14
            }
          },
          beginAtZero: true,
          ticks: {
            callback: (value, _index, _values) => `${value}ft`,
          },
        },
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        title: {
          display: true,
          text: `${buoy.Name} (${buoy.id})`,
          font: {
            size: 16,
          },
        },
        legend: {
          labels: {
            generateLabels: (chart) => {
              const seenGroups = new Set();
              return chart.data.datasets
                .map((ds, index) => ({ ds, index }))
                .filter(({ ds }) => ds.group && !seenGroups.has(ds.group) && seenGroups.add(ds.group))
                .map(({ ds, index }) => ({
                  text: ds.group,
                  fillStyle: ds.backgroundColor,
                  strokeStyle: ds.borderColor,
                  lineWidth: ds.borderWidth,
                  hidden: !chart.isDatasetVisible(index),
                  datasetIndex: index,
                  group: ds.group,  // add group info for easy access
                }));
            }
          },
          onClick: (e, legendItem, legend) => {
            const chart = legend.chart;
            const group = legendItem.group;

            // Find all dataset indices that belong to this group
            const indices = chart.data.datasets
              .map((ds, i) => (ds.group === group ? i : -1))
              .filter(i => i !== -1);

            // Determine if they are all currently visible or not
            const allVisible = indices.every(i => chart.isDatasetVisible(i));

            // Toggle visibility for all datasets in this group
            indices.forEach(i => {
              chart.setDatasetVisibility(i, !allVisible);
            });

            chart.update();
          },
        },
        tooltip: {
          callbacks: {
            labelColor: (context) => {
              const { borderColor, backgroundColor } = { ...context.dataset };
              return {
                borderWidth: 1,
                borderColor,
                backgroundColor,
              };
            },
            label: (context) => {
              let label = `${context.parsed.y}ft`;
              if (context.raw.label) {
                label += ` @ ${context.raw.label}`;
              } else {
                label += ' Combined Height';
              }
              return label;
            },
          },
        },
      },
    },
  });
};

const periodToSwellType = (period) => {
  if (period <= 6) {
    return { key: 'spws', Name: 'Short Period Windswell', color: '#0000ff' };
  } else if (period <= 9) {
    return { key: 'ws', Name: 'Windswell', color: '#00b7ff' };
  } else if (period <= 13) {
    return { key: 'mps', Name: 'Mid Period Swell', color: '#ffca00' };
  } else if (period <= 18) {
    return { key: 'gs', Name: 'Groundswell', color: '#ff8223' };
  } else {
    return { key: 'lpgs', Name: 'Long Period Groundswell', color: '#e60000' };
  }
};

const degreeToCompass = (deg) => {
  const val = Math.floor(deg / 22.5 + 0.5);
  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  return directions[val % 16];
};

const verticalLineChartPlugin = {
  id: 'verticalLine',
  afterDraw: (chart) => {
    if (chart.tooltip?._active?.length) {
      let x = chart.tooltip._active[0].element.x;
      let yAxis = chart.scales.y;
      let ctx = chart.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, yAxis.top);
      ctx.lineTo(x, yAxis.bottom);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'lightgrey';
      ctx.stroke();
      ctx.restore();
    }
  },
};
