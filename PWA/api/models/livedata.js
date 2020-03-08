var mongoose = require( 'mongoose' );

var dataSchema = new mongoose.Schema({
  applicationName: String,
  deviceName: String,
  deviceBattery: Number,
  nodeBDA: String,
  nodeBattery: Number,
  timestamp: Number,
  data: {
    temp: Number,
    lux: Number,
    moist: Number,
    cond: Number,
  },
  forecast: {
    main: String,
    percipIntensity: Number,
    percipProbability: Number,
    windGust: Number,
    cloudCover: Number,
    uvIndex: Number
  }
});

mongoose.model('DataInput', dataSchema);