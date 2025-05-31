$(document).ready(() => {
  addBuoyForecastImages();
  generateLiveBuoyCharts();
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

const fetchBuoyData = async (buoyUuid) => {
  let days = 2;
  if (window.innerWidth <= 500 || (window.innerWidth < 991 && window.innerWidth > 768)) days = 2;
  const url = `https://services.surfline.com/kbyg/buoys/report/${buoyUuid}?days=${days}`;
  const response = await window.fetch(url);
  const jsonResponse = await response.json();
  return jsonResponse.data;
};

const generateLiveBuoyCharts = async () => {
  const buoys = [
    { id: '46214', uuid: '623f2558-cecd-11eb-8ee7-024238d3b313', displayName: 'Point Reyes' },
    { id: '46239', uuid: '8f74b3c0-cecc-11eb-ad35-024238d3b313', displayName: 'Point Sur'},
    { id: '46236', uuid: 'a7560458-df9d-11ef-ac15-029daffad6a3', displayName: 'Monterey Canyon Outer'},
    { id: '46028', uuid: '48a1002e-cecd-11eb-ba0e-024238d3b313', displayName: 'Cape San Martin'},
    { id: '46284', uuid: '3072ff0a-b656-11ef-94ee-066f3c48800f', displayName: 'Soquel Cove South'},
    { id: '46240', uuid: 'a3336676-cecd-11eb-9a27-024238d3b313', displayName: 'Cabrillo Point'},
    { id: '46042', uuid: 'dcfce512-cecb-11eb-b0c8-024238d3b313', displayName: 'Monterey'},
    { id: '46012', uuid: '780b2a02-cecb-11eb-9ccc-024238d3b313', displayName: 'Half Moon Bay'},
    { id: '46269', uuid: 'a011a1e4-cecb-11eb-abf8-024238d3b313', displayName: 'Point Santa Cruz'},
  ];
  buoys.forEach(async (buoy) => {
    const buoyData = await fetchBuoyData(buoy.uuid);
    createLiveBuoyChart(buoy, buoyData);
  });
};

const createLiveBuoyChart = (buoy, buoyData) => {
  const combinedHeightDataset = {
    data: [],
    label: 'Combined Height',
    borderColor: '#5b5b5b',
    backgroundColor: '#5b5b5b',
    borderWidth: 5,
    pointRadius: 0,
    tension: 0.5,
  };
  let swellDatasets = {};
  const dates = [];
  const waterTemps = [];
  buoyData.forEach((datapoint) => {
    const date = new Date(datapoint.timestamp * 1000);
    // There is often duplicate data at 40 and 50 minute marks, so only use one.
    if (date.getMinutes() === 40) return;

    dates.push(date);
    if (datapoint.waterTemperature) waterTemps.push(datapoint.waterTemperature);
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
      if (!swellDatasets[key]) {
        swellDatasets[key] = {
          data: [],
          borderColor: swellType.color,
          backgroundColor: swellType.color,
          tension: 0.5,
          spanGaps: false,
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
    dataset.label = `${periodToSwellType(dataset.data[0].period).displayName} | ${degreeToCompass(
      minDir
    )} (${minDir}°) - ${degreeToCompass(maxDir)} (${maxDir}°)`;
    dates.forEach((date, index) => {
      const existingDatapoint = dataset.data.find((dp) => dp.x === date);
      if (!existingDatapoint) dataset.data.splice(index, 0, { x: date, y: NaN });
    });
    return dataset;
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
      <img class='waterdrop' src='https://jeremykirc.github.io/surf/waterdrop.png'></img>
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
          text: `${buoy.displayName} (${buoy.id})`,
          font: {
            size: 16,
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
    return { key: 'spws', displayName: 'Short Period Windswell', color: '#0000ff' };
  } else if (period <= 9) {
    return { key: 'ws', displayName: 'Windswell', color: '#00b7ff' };
  } else if (period <= 12) {
    return { key: 'mps', displayName: 'Mid Period Swell', color: '#ffca00' };
  } else if (period <= 17) {
    return { key: 'gs', displayName: 'Groundswell', color: '#ff8223' };
  } else {
    return { key: 'lpgs', displayName: 'Long Period Groundswell', color: '#e60000' };
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
