
var mongoose = require('mongoose');
var DataInput = mongoose.model('DataInput');
var Users = mongoose.model('User');

var request = require('request');

// -------- microservices for weather forecast -------------
const darkSkyKey = '80275f0d96a77e32e431df77ea909221';
var currentForecast;

// ---------------------------------------------------------

// -------- microservices for ml prediction -------------
const fs = require('fs');
const tf = require('@tensorflow/tfjs');
const tfvis = require('@tensorflow/tfjs-vis');

// training paramters
const epochs = 40;
const learningRate = 0.01;

var classes = [];
var model = {};
initML();

// ---------------------------------------------------------

var sendJSONresponse = function(res, status, content) {
  res.status(status);
  res.json(content);
};

function parseIncomingPacket(body){

  // var newDataStream = '00:00:00:00:00:00:F7:00:00:49:00:00:00:00:00:00:02:3C:00:FB:34:9B';
  var newDataStream = new Buffer.from(body.data, 'base64').toString();
  var dataArray = newDataStream.split(':');

  // console.log(newDataStream);

  var realtimeData = {
    temp: parseInt(dataArray.slice(6, 8).reverse().join(''), 16),
    lux: parseInt(dataArray.slice(8, 12).reverse().join(''), 16),
    moist: parseInt(dataArray.slice(12, 13).reverse().join(''), 16),
    cond: parseInt(dataArray.slice(13, 15).reverse().join(''), 16) 
  }

  var submit = {
    applicationName: body.applicationName,
    deviceName: body.deviceName,
    nodeBDA: dataArray.slice(0, 6).join(':'),
    battery: parseInt(dataArray.slice(15).reverse().join(''), 16), 
    timestamp: Date.now(),
    data: realtimeData
  }

  return submit;
}

function readFile(path) {
  var fileContent;

  return new Promise(function(resolve) {
    fileContent = fs.readFileSync(path, {encoding: 'utf8'});
    resolve(fileContent);
  });
}

async function loadData(){
  var csvContent = await readFile(__dirname + '/plantData.csv');
  var rows = csvContent.split('\r\n');

  var classes = rows[0].split(',');
  var data = [];

  for(var i = 1; i < rows.length; i++){
    data.push(rows[i].split(',').map(function(item) {
      return parseInt(item, 10);
    }));
  }

  return {
    classes: classes,
    data: data
  }
}

function convertToTensors(data, targets, testSplit, numClasses) {
  const numExamples = data.length;
  if (numExamples !== targets.length) {
    throw new Error('data and split have different numbers of examples');
  }

  // Randomly shuffle `data` and `targets`.
  const indices = [];
  for (let i = 0; i < numExamples; ++i) {
    indices.push(i);
  }
  tf.util.shuffle(indices);

  const shuffledData = [];
  const shuffledTargets = [];
  for (let i = 0; i < numExamples; ++i) {
    shuffledData.push(data[indices[i]]);
    shuffledTargets.push(targets[indices[i]]);
  }

  // Split the data into a training set and a tet set, based on `testSplit`.
  const numTestExamples = Math.round(numExamples * testSplit);
  const numTrainExamples = numExamples - numTestExamples;

  const xDims = shuffledData[0].length;

  // Create a 2D `tf.Tensor` to hold the feature data.
  const xs = tf.tensor2d(shuffledData, [numExamples, xDims]);

  // Create a 1D `tf.Tensor` to hold the labels, and convert the number label
  // from the set {0, 1, 2} into one-hot encoding (.e.g., 0 --> [1, 0, 0]).
  const ys = tf.oneHot(tf.tensor1d(shuffledTargets).toInt(), numClasses);

  // Split the data into training and test sets, using `slice`.
  const xTrain = xs.slice([0, 0], [numTrainExamples, xDims]);
  const xTest = xs.slice([numTrainExamples, 0], [numTestExamples, xDims]);
  const yTrain = ys.slice([0, 0], [numTrainExamples, numClasses]);
  const yTest = ys.slice([0, 0], [numTestExamples, numClasses]);
  return [xTrain, yTrain, xTest, yTest];
}

async function getFormattedData(testSplit) {

  var snapshot = await loadData();

  return tf.tidy(() => {
    const dataByClass = [];
    const targetsByClass = [];
    for (let i = 0; i < snapshot.classes.length; ++i) {
      dataByClass.push([]);
      targetsByClass.push([]);
    }
    for (const example of snapshot.data) {
      const target = Number(example[example.length - 1]);
      const data = example.slice(0, example.length - 1);
      dataByClass[target].push(data);
      targetsByClass[target].push(target);
    }

    const xTrains = [];
    const yTrains = [];
    const xTests = [];
    const yTests = [];
    for (let i = 0; i < snapshot.classes.length; ++i) {
      const [xTrain, yTrain, xTest, yTest] =
          convertToTensors(dataByClass[i], targetsByClass[i], testSplit, snapshot.classes.length);
      xTrains.push(xTrain);
      yTrains.push(yTrain);
      xTests.push(xTest);
      yTests.push(yTest);
    }

    const concatAxis = 0;
    return [
      tf.concat(xTrains, concatAxis), tf.concat(yTrains, concatAxis),
      tf.concat(xTests, concatAxis), tf.concat(yTests, concatAxis),
      snapshot.classes
    ];
  });
}

async function trainModel(xTrain, yTrain, xTest, yTest) {
  console.log('Training model... Please wait.');

  const params = {
    epochs: epochs,
    learningRate: learningRate
  };;

  // Define the topology of the model: two dense layers.
  const model = tf.sequential();
  model.add(tf.layers.dense(
      {units: 10, activation: 'sigmoid', inputShape: [xTrain.shape[1]]}));
  model.add(tf.layers.dense({units: 3, activation: 'softmax'}));
  model.summary();

  const optimizer = tf.train.adam(params.learningRate);
  model.compile({
    optimizer: optimizer,
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  const history = await model.fit(xTrain, yTrain, {
    epochs: params.epochs,
    validationData: [xTest, yTest],
    callbacks: {
      onEpochEnd: async (epoch, logs) => {
        console.log('completed:' + ((epoch / epochs) * 100).toFixed(0) + '%');
      },
    }
  });
  
  console.log('done...');
  return model;
}

async function predictOnManualInput(model, inputData, classes, resolve) {
  tf.tidy(() => {
    const input = tf.tensor2d([inputData], [1, 4]);

    const predictOut = model.predict(input);
    const logits = Array.from(predictOut.dataSync());
    const winner = classes[predictOut.argMax(-1).dataSync()[0]];

    resolve(winner);
  });
}

async function initML(){
  // organise data
  const [xTrain, yTrain, xTest, yTest, observed] = await getFormattedData(0.15);
  
  classes = observed;
  model = await trainModel(xTrain, yTrain, xTest, yTest);
};

module.exports.onUpdateForecast = async function(){ // should use this oppurtunity to update forecast on gateway lat lng
  request({
    headers: {
        'Content-Type': 'application/json', 
        'Accept': 'application/json'
    },
    url: 'https://api.darksky.net/forecast/' + darkSkyKey
      + '/-27.499774900000002,153.0151951?exclude=minutely,hourly&units=si',
    method: 'GET',
  }, function (err, resp, body){

    if(err) return console.error(err);

    var res = JSON.parse(body);

    currentForecast = res;
  });
}

module.exports.writeNewData = async function(req, res) {

  console.log(req.params.src)
  console.log(req.body);

  if(req.params.src === 'uplink'){
    var dataInput = new DataInput();

    var inputStruct = parseIncomingPacket(req.body);

    // console.log(inputStruct);

    dataInput.applicationName = inputStruct.applicationName;
    dataInput.deviceName = inputStruct.deviceName;
    dataInput.deviceBattery = inputStruct.battery;

    dataInput.timestamp = inputStruct.timestamp;

    dataInput.nodeBDA = inputStruct.nodeBDA;
    dataInput.nodeBattery = 100;
    
    dataInput.data = inputStruct.data;
    dataInput.forecast = currentForecast;

    dataInput.save(function(err) {
      res.status(200).json({
        "status" : "OK"
      });
    });
    
  }else{
    res.status(200).json({
      "status" : "OK"
    });
  }
};


module.exports.readData = function(req, res) {

  let devices = req.query.devices.split(',');
  let timestampFrom = req.query.timestampFrom;
  let timestampTill = req.query.timestampTill;
  let limit = req.query.limit;

  if (!req.payload._id) {
    res.status(401).json({
      "message" : "UnauthorizedError: private profile"
    });
  } else {
    DataInput.find({
        'nodeBDA': { $in: devices},
        'timestamp' : {$gte : timestampFrom, $lte : timestampTill}
      })
    .limit(Number(limit))
    .exec((err, docs) => {
      if(err){
        console.log(err);
        res.status(401).json({
          "message" : "Invalid request: " + JSON.stringify(req.query)
        });

      }else{
        res.status(200).json({
          "status": "OK",
          "data": docs
        });
      }
    });
  }
};

module.exports.getPrediction = function(req, res) {

  let devices = req.query.devices;

  if (!req.payload._id) {
    res.status(401).json({
      "message" : "UnauthorizedError: private profile"
    });
  } else {
    DataInput.find({
      'nodeBDA': { $in: [devices]} 
    })
    .sort({'timestamp': -1})
    .limit(1)
    .exec((err, docs) => {
      if(err){
        console.log(err);
        return res.status(401).json({
          "message" : "Invalid request: " + JSON.stringify(req.query)
        });

      }else{
        if(docs.length === 0){
          return res.status(200).json({
            "status": "OK",
            "data": docs
          });
        }

        // console.log(docs);

        const inputData = [
          docs[0].data.temp, 
          docs[0].data.lux, 
          docs[0].data.moist, 
          docs[0].data.cond
        ];
        return predictOnManualInput(model, inputData, classes, (winner) => {
          return res.status(200).json({
            "status": "OK",
            "data": {
              "winner": winner,
              "node": docs[0].deviceName,
              "nodeBattery": docs[0].nodeBattery,
              "deviceBattery": docs[0].deviceBattery,
              "state": {
                "timestamp": docs[0].timestamp,
                "temp": docs[0].data.temp,
                "lux": docs[0].data.lux,
                "moist": docs[0].data.moist,
                "cond": docs[0].data.cond
              }
            }
        });
        });
      }
    });
  }
};

module.exports.readForecast = function(req, res) {

  return res.status(200).json({
    "status" : "OK",
    "data" : currentForecast
  });
};

module.exports.addDeviceData = function(req, res) {

  console.log(req.payload);

  Users.update(
    {_id: req.payload._id}, 
    {$push: {devices: req.body}}, (err, status) => {

      if(err){
        return res.status(501).json({
          "status": "ERROR ADDING DEVICE",
          "message": err 
        });
      }

      return res.status(200).json({
        "status" : "OK"
      });
    });
};