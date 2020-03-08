import { Component, OnInit, ViewChild } from '@angular/core';
import { FormGroup,  FormBuilder,  Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthenticationService, UserDetails } from '../authentication.service';

import { SensorDataService } from '../sensor-data.service';

import { DeviceManager } from '../device-manager.service';
import { DeviceModel } from '../models/device-model';

import { ChartDataSets, ChartOptions, ChartType } from 'chart.js';
import { Color, BaseChartDirective, Label } from 'ng2-charts';
import * as pluginAnnotations from 'chartjs-plugin-annotation';

@Component({
  templateUrl: './view-device.component.html'
})
export class ViewDeviceComponent implements OnInit {
	snapshot: any;
  
  deviceName: string = '';
  deviceLocation: string;
  deviceDescription: string;
  deviceBattery: number;
  deviceBDA: string;

  loraNode: string;
  nodeBattery: number;

  timestamp: string = '';
  winner: string = '';

  state: {temp: string, lux: string, moist: string, cond: string} = {
    temp: '',
    lux: '',
    moist: '',
    cond: ''
  };
  
  timescale: string[] = [];

  angForm: FormGroup;

  constructor(
  	private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    public dm: DeviceManager,
    private auth: AuthenticationService, 
    private sensor: SensorDataService){

      this.createForm();
    }

  ngOnInit() {
  	this.route.params.subscribe(params => {
      
      this.deviceName = params['name'];
      for(var i = 0; i < this.dm.deviceList.length; i++){
        if(this.dm.deviceList[i].title === this.deviceName){

          console.log(this.dm.deviceList[i]);

          this.deviceDescription = this.dm.deviceList[i].description;
          this.deviceLocation = 
            'lat: ' + this.dm.deviceList[i].location.lat + ' lng: ' + this.dm.deviceList[i].location.lng;
          this.deviceBDA = this.dm.deviceList[i].bda;
        }
      }

   		this.updateData(0, Date.now(), 30);
      this.updatePrediction();
    });
  }

  private createForm() {
    this.angForm = this.fb.group({
      timestampFrom: ['', Validators.required ],
      timestampTill: ['', Validators.required ]
    });
  }


  public filterForTimestamp(timestampFrom, timestampTill) {
    this.updateData(
      new Date(timestampFrom).getTime(),
      new Date(timestampTill).getTime(), null);
  }

  public updatePrediction(): void {
    this.sensor.withdrawPrediction(this.deviceBDA).subscribe(res => {

      if(res.data.length == 0){
        this.timestamp = '';
        this.winner = '';
        this.state = {temp: '', lux: '', moist: '', cond: ''};
      }else{
        console.log(res);

        var d = new Date(0);
        d.setUTCMilliseconds(res.data.state.timestamp);

        this.timestamp = d.toString();
        this.winner = res.data.winner;
        
        this.state = res.data.state;
        this.state.temp = ((res.data.state.temp / 10) + ((res.data.state.temp % 10) / 10)).toString();

        this.loraNode = res.data.node;
        this.nodeBattery = res.data.nodeBattery;
        this.deviceBattery = res.data.deviceBattery;
      }
    });
  }

  public updateData(timestampFrom, timestampTill, limit): void {
    this.sensor.withdrawData([this.deviceBDA], timestampFrom, timestampTill, limit).subscribe(res => {
      this.snapshot = res;
      var dataLength = this.snapshot.data.length; 

      // reset data
      this.timescale = [];

      for (let i = 0; i < dataLength; i++) {

        // sensor data...
        this.lineChartTempData[0].data[i] = (this.snapshot.data[i].data.temp / 10) + ((this.snapshot.data[i].data.temp % 10) / 10);
        this.lineChartLuxData[0].data[i] = this.snapshot.data[i].data.lux;
        this.lineChartMoistData[0].data[i] = this.snapshot.data[i].data.moist;
        this.lineChartCondData[0].data[i] = this.snapshot.data[i].data.cond;

        var d = new Date(0);
        d.setUTCMilliseconds(this.snapshot.data[i].timestamp + 36000000);

        var formatTime = d.toISOString().replace(/T/, ' '). replace(/\..+/, '');
        this.timescale.push(formatTime);
      }

      this.lineChartLabels = this.timescale;
      this.chart.update();

    });
  }

  // --- Line Chart ---

  public lineChartTempData: ChartDataSets[] = [
    { data: [0], label: 'Temperature (°C)' },
  ];

  public lineChartLuxData: ChartDataSets[] = [
    { data: [0], label: 'Lux' },
  ];

  public lineChartMoistData: ChartDataSets[] = [
    { data: [0], label: 'Moisture (%)' },
  ];

  public lineChartCondData: ChartDataSets[] = [
    { data: [0], label: 'Conductivity (µS/cm)' },
  ];
  public lineChartLabels: Label[] = [];

  public lineChartOptions: (ChartOptions & { annotation: any }) = {
    responsive: true,
    scales: {
      // We use this empty structure as a placeholder for dynamic theming.
      xAxes: [{}],
      yAxes: [{}]
    },
    annotation: {
      annotations: [],
    },
  };

  public lineChartColors: Color[] = [
    { // grey
      backgroundColor: 'rgba(148,159,177,0.2)',
      borderColor: 'rgba(148,159,177,1)',
      pointBackgroundColor: 'rgba(148,159,177,1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(148,159,177,0.8)'
    }
  ];
  public lineChartLegend = true;
  public lineChartType = 'line';
  public lineChartPlugins = [pluginAnnotations];

  @ViewChild(BaseChartDirective) chart: BaseChartDirective;

  // End Line Chart

}
